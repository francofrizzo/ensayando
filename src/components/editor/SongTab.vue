<script setup lang="ts">
import {
  IconMoveDown,
  IconMoveUp,
  IconMusic,
  IconSettings,
  IconVisible,
  IconHash,
  IconLink,
  IconLock,
  IconPlus,
  IconTrash,
  IconUpload
} from "@/components/ui/icons";
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";

import AudioTrackUploader from "@/components/editor/AudioTrackUploader.vue";
import ColorPicker from "@/components/editor/ColorPicker.vue";
// PeaksUploader removed; peaks are generated client-side
import SafeTeleport from "@/components/ui/SafeTeleport.vue";
import { useCollectionPalette } from "@/composables/useCollectionPalette";
import { useCurrentCollection } from "@/composables/useCurrentCollection";
import { useCurrentSong } from "@/composables/useCurrentSong";
import { useEditorTab } from "@/composables/useEditorSession";
import {
  deleteAudioTracks,
  insertAudioTrack,
  insertSong,
  updateAudioTrack,
  updateSongBasicInfo
} from "@/data/supabase";
import { audioPlaybackUrl, deleteAudioFile } from "@/data/storage";
import type { AudioTrack, TrackPeaks } from "@/data/types";
import { useAuthStore } from "@/stores/auth";
import { useCollectionsStore } from "@/stores/collections";
import { generateTrackPeaks } from "@/utils/audio-utils";
import {
  generateSlugFromTitle as generateSlug,
  songDurationFromTracks,
  validateSongForm
} from "@/utils/songUtils";

// Composables and stores
const { currentSong } = useCurrentSong();
const { currentCollection } = useCurrentCollection();
const router = useRouter();
const authStore = useAuthStore();
const collectionsStore = useCollectionsStore();

// Reactive state
const formData = reactive({
  title: "",
  slug: "",
  visible: true,
  audio_tracks: [] as AudioTrack[]
});

const isSaving = ref(false);
const isDirty = ref(false);
const isInitializing = ref(true);
const isCreateMode = ref(false);
const trackKeyCounter = ref(0);
const uploadingTrackIndex = ref<number | null>(null);
const peaksGeneratingIndex = ref<number | null>(null);
const draggingTrackId = ref<number | null>(null);
const trackDragDepths = new Map<number, number>();
const audioUploaderRefs = new Map<number, { uploadDroppedFile: (file: File) => Promise<void> }>();
const pendingUploadKeys = new Set<string>();
const errors = reactive({
  title: "",
  slug: "",
  audio_tracks: ""
});

// Utility functions
const clearErrors = () => {
  Object.keys(errors).forEach((key) => {
    (errors as Record<string, string>)[key] = "";
  });
};

const sortTracksByOrder = (tracks: AudioTrack[]) =>
  [...tracks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

const serializeFormData = (song: typeof currentSong.value) =>
  song ? JSON.parse(JSON.stringify(sortTracksByOrder(song.audio_tracks))) : [];

const restoreFormFromSong = (song: typeof currentSong.value) => {
  if (!song) return;

  formData.title = song.title;
  formData.slug = song.slug;
  formData.visible = song.visible;
  formData.audio_tracks = serializeFormData(song);
  isDirty.value = false;
  isInitializing.value = true;
  nextTick(() => {
    isInitializing.value = false;
  });
  clearErrors();
};

const generateSlugFromTitle = () => {
  formData.slug = generateSlug(formData.title);
};

// Track operations
const createNewTrack = (): AudioTrack => {
  const newOrder = Math.max(...formData.audio_tracks.map((t) => t.order ?? 0), 0) + 1;
  trackKeyCounter.value++;

  const availableColors = Object.keys(currentCollection.value?.track_colors ?? {});
  const defaultColorKey = availableColors[0] ?? "blue";

  return {
    id: -trackKeyCounter.value,
    song_id: currentSong.value?.id ?? 0,
    title: "",
    color_key: defaultColorKey,
    audio_file_url: "",
    audio_file_key: null,
    peaks: null,
    order: newOrder,
    created_at: new Date().toISOString()
  };
};

const updateTrackField = (
  index: number,
  field: keyof AudioTrack,
  value: AudioTrack[keyof AudioTrack]
) => {
  const newTracks = [...formData.audio_tracks];
  newTracks[index] = { ...newTracks[index]!, [field]: value };
  formData.audio_tracks = newTracks;
};

const reorderTracks = () => {
  formData.audio_tracks = formData.audio_tracks.map((track, i) => ({
    ...track,
    order: i + 1
  }));
};

const swapTracks = (index1: number, index2: number) => {
  const newTracks = [...formData.audio_tracks];
  [newTracks[index1], newTracks[index2]] = [newTracks[index2]!, newTracks[index1]!];
  formData.audio_tracks = newTracks;
  reorderTracks();
};

const addAudioTrack = () => {
  formData.audio_tracks = [...formData.audio_tracks, createNewTrack()];
};

const removeAudioTrack = async (index: number) => {
  const track = formData.audio_tracks[index];
  formData.audio_tracks = formData.audio_tracks.filter((_, i) => i !== index);
  reorderTracks();

  if (track?.audio_file_key && pendingUploadKeys.has(track.audio_file_key)) {
    await cleanupUploadedFiles([track.audio_file_key]);
  }
};

const moveTrackUp = async (index: number) => {
  if (index > 0) {
    swapTracks(index, index - 1);
    await nextTick();
  }
};

const moveTrackDown = async (index: number) => {
  if (index < formData.audio_tracks.length - 1) {
    swapTracks(index, index + 1);
    await nextTick();
  }
};

// Event handlers
const handleTitleBlur = () => {
  if (!formData.slug) {
    generateSlugFromTitle();
  }
};

const handleTrackTitleInput = (index: number, event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  updateTrackField(index, "title", value);
};

const handleTrackUrlInput = (index: number, event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  const previousKey = formData.audio_tracks[index]?.audio_file_key;
  updateTrackField(index, "audio_file_url", value);
  updateTrackField(index, "audio_file_key", null);
  updateTrackField(index, "playback_url", value);

  if (previousKey && pendingUploadKeys.has(previousKey)) {
    void cleanupUploadedFiles([previousKey]);
  }
};

const handleColorChange = (index: number, colorKey: string) => {
  updateTrackField(index, "color_key", colorKey);
};

const handleUploadStart = (index: number) => {
  uploadingTrackIndex.value = index;
};

const handleUploadEnd = () => {
  uploadingTrackIndex.value = null;
};

const setAudioUploaderRef = (trackId: number, instance: unknown) => {
  if (instance) {
    audioUploaderRefs.set(
      trackId,
      instance as { uploadDroppedFile: (file: File) => Promise<void> }
    );
  } else {
    audioUploaderRefs.delete(trackId);
  }
};

const handleTrackDragEnter = (trackId: number) => {
  if (!formData.slug && isCreateMode.value) return;
  trackDragDepths.set(trackId, (trackDragDepths.get(trackId) ?? 0) + 1);
  draggingTrackId.value = trackId;
};

const handleTrackDragLeave = (trackId: number) => {
  const nextDepth = Math.max((trackDragDepths.get(trackId) ?? 1) - 1, 0);
  if (nextDepth > 0) {
    trackDragDepths.set(trackId, nextDepth);
    return;
  }

  trackDragDepths.delete(trackId);
  if (draggingTrackId.value === trackId) draggingTrackId.value = null;
};

const handleTrackDrop = async (trackId: number, event: DragEvent) => {
  trackDragDepths.delete(trackId);
  draggingTrackId.value = null;

  const file = event.dataTransfer?.files[0];
  if (file) await audioUploaderRefs.get(trackId)?.uploadDroppedFile(file);
};

const handleUploadSuccess = (
  index: number,
  data: { key: string; url: string; suggestedTitle: string; peaks: TrackPeaks | null }
) => {
  const previousKey = formData.audio_tracks[index]?.audio_file_key;
  pendingUploadKeys.add(data.key);
  updateTrackField(index, "audio_file_url", "");
  updateTrackField(index, "audio_file_key", data.key);
  updateTrackField(index, "playback_url", data.url);

  if (previousKey && previousKey !== data.key && pendingUploadKeys.has(previousKey)) {
    void cleanupUploadedFiles([previousKey]);
  }

  const track = formData.audio_tracks[index];
  if (track && !track.title) {
    updateTrackField(index, "title", data.suggestedTitle);
  }

  if (data.peaks) {
    updateTrackField(index, "peaks", data.peaks);
  }
};

// Advanced options (duration manual input)
const showAdvancedOptions = ref(false);

const handleGeneratePeaks = async (index: number) => {
  const track = formData.audio_tracks[index];
  if (!track || !audioPlaybackUrl(track)) return;

  peaksGeneratingIndex.value = index;
  try {
    const response = await fetch(audioPlaybackUrl(track), { cache: "no-store" });
    const blob = await response.blob();
    const filename = track.title ? `${track.title}.audio` : `track-${track.id}.audio`;
    const file = new File([blob], filename, { type: blob.type || "audio/mpeg" });
    const peaks = await generateTrackPeaks(file);
    updateTrackField(index, "peaks", peaks);
    toast.success("Forma de onda generada correctamente");
  } catch (error: unknown) {
    console.error("Error generating peaks:", error);
    toast.error("No se pudo generar la forma de onda");
  } finally {
    peaksGeneratingIndex.value = null;
  }
};

// Validation
const validateForm = () => {
  clearErrors();
  const result = validateSongForm(formData);
  Object.assign(errors, result.errors);
  return result.isValid;
};

const cleanupUploadedFiles = async (keys: string[]) => {
  await Promise.all(
    [...new Set(keys)].map(async (key) => {
      try {
        await deleteAudioFile(key);
        pendingUploadKeys.delete(key);
      } catch (error) {
        console.error("Error cleaning up audio file:", error);
        toast.warning("No se pudo limpiar un archivo de audio sin uso");
      }
    })
  );
};

const cleanupPendingUploads = async () => {
  await cleanupUploadedFiles([...pendingUploadKeys]);
};

// Mode management
const enterCreateMode = async () => {
  await cleanupPendingUploads();
  isCreateMode.value = true;
  formData.title = "";
  formData.slug = "";
  formData.visible = true;
  formData.audio_tracks = [];
  isDirty.value = false;
  clearErrors();
};

const cancelCreateMode = async () => {
  await cleanupPendingUploads();
  isCreateMode.value = false;
  restoreFormFromSong(currentSong.value);
};

// Save operations
const saveAudioTracks = async (songId: number) => {
  for (const track of formData.audio_tracks) {
    const trackData = {
      song_id: songId,
      title: track.title,
      color_key: track.color_key,
      audio_file_url: track.audio_file_url,
      audio_file_key: track.audio_file_key ?? null,
      peaks: track.peaks ?? null,
      order: track.order
    };

    if (track.id < 0) {
      const { error } = await insertAudioTrack(trackData);
      if (error) throw error;
    }
  }
};

const updateExistingTracks = async () => {
  if (!currentSong.value) return;

  const existingTrackIds = currentSong.value.audio_tracks.map((t) => t.id);
  const formTrackIds = formData.audio_tracks.filter((t) => t.id > 0).map((t) => t.id);
  const tracksToDelete = existingTrackIds.filter((id) => !formTrackIds.includes(id));

  // Delete removed tracks
  if (tracksToDelete.length > 0) {
    const { error } = await deleteAudioTracks(tracksToDelete);
    if (error) throw error;
  }

  // Update existing tracks
  for (const track of formData.audio_tracks.filter((t) => t.id > 0)) {
    const originalTrack = currentSong.value.audio_tracks.find((t) => t.id === track.id);
    if (!originalTrack) continue;

    const updateData: Partial<AudioTrack> = {};
    const fieldsToCheck = [
      "title",
      "color_key",
      "audio_file_url",
      "audio_file_key",
      "order",
      "peaks"
    ] as const;

    fieldsToCheck.forEach((field) => {
      if (track[field] !== originalTrack[field]) {
        (updateData as Partial<Record<typeof field, AudioTrack[typeof field]>>)[field] =
          track[field];
      }
    });

    if (Object.keys(updateData).length > 0) {
      const { error } = await updateAudioTrack(track.id, updateData);
      if (error) throw error;
    }
  }

  // Insert new tracks
  await saveAudioTracks(currentSong.value.id);
};

const handleCreateSong = async () => {
  if (
    !validateForm() ||
    !authStore.isAuthenticated ||
    !collectionsStore.canEditCurrentCollection ||
    !currentCollection.value
  ) {
    return;
  }

  isSaving.value = true;

  try {
    const { data: newSongData, error: songError } = await insertSong({
      collection_id: currentCollection.value.id,
      title: formData.title,
      slug: formData.slug,
      visible: formData.visible,
      duration: songDurationFromTracks(formData.audio_tracks)
    });

    if (songError) throw songError;
    if (!newSongData?.[0]) throw new Error("No se pudo crear la canción");

    const newSong = newSongData[0];
    await saveAudioTracks(newSong.id);
    formData.audio_tracks.forEach((track) => {
      if (track.audio_file_key) pendingUploadKeys.delete(track.audio_file_key);
    });
    await cleanupPendingUploads();
    await collectionsStore.fetchSongsByCollectionId(currentCollection.value.id);

    toast.success("Canción creada correctamente");
    isCreateMode.value = false;
    isDirty.value = false;
    void router.replace({
      name: "song",
      params: { collectionSlug: currentCollection.value.slug, songSlug: newSong.slug },
      query: { editar: "cancion" }
    });
  } catch (error: unknown) {
    console.error("Error creating song:", error);
    toast.error(
      "Error al crear la canción: " + (error instanceof Error ? error.message : String(error))
    );
  } finally {
    isSaving.value = false;
  }
};

const handleUpdateSong = async () => {
  if (
    !validateForm() ||
    !currentSong.value ||
    !authStore.isAuthenticated ||
    !collectionsStore.canEditCurrentCollection ||
    !currentCollection.value
  ) {
    return;
  }

  isSaving.value = true;
  const originalSlug = currentSong.value.slug;

  try {
    const { error: songError } = await updateSongBasicInfo(currentSong.value.id, {
      title: formData.title,
      slug: formData.slug,
      visible: formData.visible,
      duration: songDurationFromTracks(formData.audio_tracks)
    });

    if (songError) throw songError;

    await updateExistingTracks();
    const activeKeys = new Set(
      formData.audio_tracks.flatMap((track) => (track.audio_file_key ? [track.audio_file_key] : []))
    );
    const replacedOrRemovedKeys = currentSong.value.audio_tracks
      .flatMap((track) => (track.audio_file_key ? [track.audio_file_key] : []))
      .filter((key) => !activeKeys.has(key));
    activeKeys.forEach((key) => pendingUploadKeys.delete(key));
    await cleanupPendingUploads();
    await cleanupUploadedFiles(replacedOrRemovedKeys);
    await collectionsStore.fetchSongsByCollectionId(currentSong.value.collection_id);

    toast.success("Canción actualizada correctamente");
    isDirty.value = false;

    if (originalSlug !== formData.slug) {
      void router.replace({
        name: "song",
        params: { collectionSlug: currentCollection.value.slug, songSlug: formData.slug },
        query: router.currentRoute.value.query
      });
    }
  } catch (error: unknown) {
    console.error("Error saving song:", error);
    toast.error(
      "Error al guardar la canción: " + (error instanceof Error ? error.message : String(error))
    );
  } finally {
    isSaving.value = false;
  }
};

const handleSave = async () => {
  if (isCreateMode.value) {
    await handleCreateSong();
  } else {
    await handleUpdateSong();
  }
};

onBeforeUnmount(() => {
  void cleanupPendingUploads();
});

// Watchers
watch(
  currentSong,
  (song) => {
    if (song && !isCreateMode.value) {
      void cleanupPendingUploads();
      restoreFormFromSong(song);
    } else if (!song && !isCreateMode.value) {
      void enterCreateMode();
    }
  },
  { immediate: true }
);

watch(
  () => ({ ...formData }),
  () => {
    if (isInitializing.value) return;
    if (isCreateMode.value) {
      isDirty.value = !!(formData.title || formData.slug || formData.audio_tracks.length > 0);
    } else if (currentSong.value) {
      const hasBasicChanges =
        formData.title !== currentSong.value.title ||
        formData.slug !== currentSong.value.slug ||
        formData.visible !== currentSong.value.visible;

      const hasTrackChanges =
        JSON.stringify(formData.audio_tracks) !==
        JSON.stringify(serializeFormData(currentSong.value));

      isDirty.value = hasBasicChanges || hasTrackChanges;
    }
  },
  { deep: true }
);

// Computed properties
// Swatches derived from the collection palette for the current theme.
const { colorOptions: colorOptions } = useCollectionPalette(currentCollection);

const tracksForRendering = computed(() =>
  formData.audio_tracks.map((track, index) => ({
    ...track,
    renderIndex: index,
    stableKey: `track-${Math.abs(track.id)}-${index}`
  }))
);

// The edit bar's Guardar / Descartar drive this form.
const editorSession = useEditorTab("cancion", {
  isDirty: () => isDirty.value,
  isSaving: () => isSaving.value,
  save: handleSave,
  discard: async () => {
    if (isCreateMode.value) await enterCreateMode();
    else await cancelCreateMode();
  }
});

defineExpose({
  isDirty,
  enterCreateMode
});
</script>

<template>
  <div class="flex h-full flex-col overflow-y-auto px-2 lg:pl-3">
    <div class="flex flex-1 flex-col gap-4 pt-2 pb-3">
      <div class="card bg-base-200 border-base-300 border shadow-sm">
        <div class="card-body p-5">
          <div class="flex items-start justify-between">
            <h3 class="text-base-content font-medium tracking-wide uppercase">
              Información básica
            </h3>
            <div class="form-control">
              <label class="label cursor-pointer justify-start gap-3">
                <div class="flex items-center gap-2">
                  <IconVisible v-if="formData.visible" class="size-4" />
                  <IconLock v-else class="size-4" />
                  <span class="label-text font-medium">
                    {{ formData.visible ? "Visible" : "Oculta" }}
                  </span>
                </div>
                <input
                  v-model="formData.visible"
                  type="checkbox"
                  class="toggle toggle-primary toggle-sm"
                />
              </label>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <div class="form-control w-full">
              <label class="label">
                <span class="label-text font-medium">Título</span>
              </label>
              <label
                class="input input-bordered flex w-full items-center gap-2"
                :class="{ 'input-error': errors.title }"
              >
                <IconMusic class="size-4 opacity-70" />
                <input
                  v-model="formData.title"
                  type="text"
                  placeholder="Título de la canción"
                  class="grow"
                  @blur="handleTitleBlur"
                />
              </label>
              <div v-if="errors.title" class="label">
                <span class="label-text-alt text-error">{{ errors.title }}</span>
              </div>
            </div>

            <div v-if="showAdvancedOptions" class="form-control w-full">
              <label class="label flex justify-between">
                <span class="label-text font-medium">Slug (URL)</span>
                <button
                  type="button"
                  class="label-text-alt link link-primary"
                  @click="generateSlugFromTitle"
                >
                  Generar desde título
                </button>
              </label>
              <label
                class="input input-bordered flex w-full items-center gap-2"
                :class="{ 'input-error': errors.slug }"
              >
                <IconHash class="size-4 opacity-70" />
                <input
                  v-model="formData.slug"
                  type="text"
                  placeholder="url-de-la-cancion"
                  class="grow font-mono"
                />
              </label>
              <div v-if="errors.slug" class="label">
                <span class="label-text-alt text-error">{{ errors.slug }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card bg-base-200 border-base-300 border shadow-sm">
        <div class="card-body gap-3 p-5">
          <div class="flex items-start justify-between">
            <h3 class="text-base-content font-medium tracking-wide uppercase">Tracks de audio</h3>
            <div class="-mt-1">
              <button class="btn btn-square btn-sm btn-soft" @click="addAudioTrack">
                <IconPlus class="size-3.5" />
                <span class="sr-only">Agregar track</span>
              </button>
            </div>
          </div>

          <div v-if="errors.audio_tracks" class="alert alert-error">
            <span class="text-sm">{{ errors.audio_tracks }}</span>
          </div>

          <div
            v-if="formData.audio_tracks.length === 0"
            class="text-base-content/60 py-8 text-center"
          >
            <IconMusic class="mx-auto mb-2 size-8 opacity-50" />
            <p>Aún no hay pistas de audio configuradas</p>
          </div>

          <div v-else class="flex flex-col gap-3">
            <div
              v-for="track in tracksForRendering"
              :key="track.stableKey"
              class="card bg-base-100 border-base-300 relative rounded-lg border border-t-[3px] transition-shadow"
              :class="{
                'ring-primary ring-2 ring-offset-2': draggingTrackId === track.id
              }"
              :style="{
                borderTopColor:
                  colorOptions?.find(
                    (c: { key: string; value: string }) =>
                      c.key === formData.audio_tracks[track.renderIndex]?.color_key
                  )?.value || 'var(--color-base-300)'
              }"
              @dragenter.prevent="handleTrackDragEnter(track.id)"
              @dragover.prevent
              @dragleave.prevent="handleTrackDragLeave(track.id)"
              @drop.prevent="handleTrackDrop(track.id, $event)"
            >
              <div
                v-if="draggingTrackId === track.id"
                class="border-primary bg-primary/15 pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-lg border-2"
              >
                <div class="badge badge-primary gap-2 px-4 py-3 font-medium shadow-lg">
                  <IconUpload class="size-4" />
                  Soltá el audio acá
                </div>
              </div>
              <div class="card-body flex flex-row items-center gap-3 p-4">
                <div class="join join-vertical -my-1 -ml-1 flex shrink-0 flex-col">
                  <button
                    class="btn btn-xs btn-ghost btn-square join-item"
                    :disabled="track.renderIndex === 0"
                    @click="moveTrackUp(track.renderIndex)"
                  >
                    <IconMoveUp class="size-3.5" />
                  </button>
                  <button
                    class="btn btn-xs btn-ghost btn-square join-item"
                    :disabled="track.renderIndex === formData.audio_tracks.length - 1"
                    @click="moveTrackDown(track.renderIndex)"
                  >
                    <IconMoveDown class="size-3.5" />
                  </button>
                </div>

                <div class="flex flex-1 flex-row flex-wrap justify-end gap-2">
                  <div class="form-control">
                    <label class="label sr-only">Color</label>
                    <ColorPicker
                      :selected-colors="[formData.audio_tracks[track.renderIndex]!.color_key]"
                      :available-colors="colorOptions"
                      :multiple="false"
                      @update:selected-colors="
                        (colors: string[]) =>
                          handleColorChange(
                            track.renderIndex,
                            colors[0] || colorOptions[0]?.key || 'blue'
                          )
                      "
                    />
                  </div>

                  <div class="form-control min-w-16 flex-1">
                    <label class="label sr-only">Título de la pista</label>
                    <input
                      :value="formData.audio_tracks[track.renderIndex]!.title"
                      type="text"
                      placeholder="Título"
                      class="input input-bordered input-sm"
                      @input="handleTrackTitleInput(track.renderIndex, $event)"
                    />
                  </div>

                  <div class="form-control min-w-32 flex-3">
                    <label class="label sr-only">URL del audio</label>
                    <label
                      class="input input-bordered input-sm flex w-full items-center gap-2"
                      :class="{ 'input-error': errors.slug }"
                    >
                      <IconLink class="size-4 opacity-70" />
                      <input
                        :value="formData.audio_tracks[track.renderIndex]!.audio_file_url"
                        type="url"
                        placeholder="URL"
                        class="grow font-mono"
                        @input="handleTrackUrlInput(track.renderIndex, $event)"
                      />
                    </label>
                  </div>

                  <div class="flex w-full items-center gap-2">
                    <AudioTrackUploader
                      v-if="currentCollection"
                      :ref="(instance) => setAudioUploaderRef(track.id, instance)"
                      :collection="currentCollection"
                      :disabled="!formData.slug && isCreateMode"
                      @upload-start="handleUploadStart(track.renderIndex)"
                      @upload-end="handleUploadEnd"
                      @upload-success="
                        (data: {
                          key: string;
                          url: string;
                          suggestedTitle: string;
                          peaks: TrackPeaks | null;
                        }) => handleUploadSuccess(track.renderIndex, data)
                      "
                    />
                    <span class="text-base-content/50 mr-auto hidden text-xs sm:inline">
                      o arrastralo sobre toda la pista
                    </span>
                    <div
                      v-if="showAdvancedOptions"
                      class="tooltip tooltip-top"
                      :data-tip="'Generar forma de onda'"
                    >
                      <button
                        class="btn btn-sm btn-square"
                        :class="
                          formData.audio_tracks[track.renderIndex]!.peaks
                            ? 'btn-primary'
                            : 'btn-soft'
                        "
                        :disabled="
                          !audioPlaybackUrl(formData.audio_tracks[track.renderIndex]!) ||
                          peaksGeneratingIndex === track.renderIndex
                        "
                        @click="handleGeneratePeaks(track.renderIndex)"
                      >
                        <template v-if="peaksGeneratingIndex === track.renderIndex">
                          <span class="loading loading-spinner loading-xs" />
                        </template>
                        <template v-else>
                          <IconMusic class="size-3.5" />
                        </template>
                      </button>
                    </div>

                    <button
                      class="btn btn-sm btn-error btn-soft btn-square shrink-0"
                      @click="removeAudioTrack(track.renderIndex)"
                    >
                      <IconTrash class="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <SafeTeleport
    v-if="editorSession.activeTab.value === 'cancion'"
    to="[data-song-editor-actions]"
  >
    <button
      class="btn btn-sm btn-circle"
      :class="showAdvancedOptions ? 'btn-primary' : 'btn-ghost'"
      :aria-pressed="showAdvancedOptions"
      aria-label="Opciones avanzadas"
      title="Opciones avanzadas"
      @click="showAdvancedOptions = !showAdvancedOptions"
    >
      <IconSettings class="size-[18px]" />
    </button>
  </SafeTeleport>
</template>
