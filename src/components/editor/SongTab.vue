<script setup lang="ts">
import {
  ArrowDown,
  ArrowUp,
  Eye,
  Hash,
  Link2,
  LockKeyhole,
  Music,
  Plus,
  Save,
  Trash2,
  X
} from "lucide-vue-next";
import { computed, nextTick, reactive, ref, watch } from "vue";
import { toast } from "vue-sonner";

import AudioTrackUploader from "@/components/editor/AudioTrackUploader.vue";
import ColorPicker from "@/components/editor/ColorPicker.vue";
import SafeTeleport from "@/components/ui/SafeTeleport.vue";
import { useCurrentCollection } from "@/composables/useCurrentCollection";
import { useCurrentSong } from "@/composables/useCurrentSong";
import { useNavigation } from "@/composables/useNavigation";
import {
  deleteAudioTracks,
  insertAudioTrack,
  insertSong,
  updateAudioTrack,
  updateSongBasicInfo
} from "@/data/supabase";
import type { AudioTrack } from "@/data/types";
import { useAuthStore } from "@/stores/auth";
import { useCollectionsStore } from "@/stores/collections";

// Constants
const VALIDATION_RULES = {
  SLUG_PATTERN: /^[a-z0-9-]+$/,
  ERRORS: {
    TITLE_REQUIRED: "El título es obligatorio",
    SLUG_REQUIRED: "El slug es obligatorio",
    SLUG_INVALID: "El slug solo puede contener letras minúsculas, números y guiones",
    TRACKS_REQUIRED: "Debe haber al menos una pista de audio"
  }
} as const;

// Composables and stores
const { currentSong } = useCurrentSong();
const { currentCollection } = useCurrentCollection();
const { replaceToSong } = useNavigation();
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
const isCreateMode = ref(false);
const trackKeyCounter = ref(0);
const uploadingTrackIndex = ref<number | null>(null);
const errors = reactive({
  title: "",
  slug: "",
  audio_tracks: ""
});

// Utility functions
const clearErrors = () => {
  Object.keys(errors).forEach((key) => {
    (errors as any)[key] = "";
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
  clearErrors();
};

const generateSlugFromTitle = () => {
  const slug = formData.title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  formData.slug = slug;
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
    order: newOrder,
    created_at: new Date().toISOString()
  };
};

const updateTrackField = (index: number, field: keyof AudioTrack, value: any) => {
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

const removeAudioTrack = (index: number) => {
  formData.audio_tracks = formData.audio_tracks.filter((_, i) => i !== index);
  reorderTracks();
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
  updateTrackField(index, "audio_file_url", value);
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

const handleUploadSuccess = (index: number, data: { url: string; suggestedTitle: string }) => {
  updateTrackField(index, "audio_file_url", data.url);

  const track = formData.audio_tracks[index];
  if (track && !track.title) {
    updateTrackField(index, "title", data.suggestedTitle);
  }
};

// Validation
const validateForm = () => {
  clearErrors();
  let isValid = true;

  if (!formData.title.trim()) {
    errors.title = VALIDATION_RULES.ERRORS.TITLE_REQUIRED;
    isValid = false;
  }

  if (!formData.slug.trim()) {
    errors.slug = VALIDATION_RULES.ERRORS.SLUG_REQUIRED;
    isValid = false;
  } else if (!VALIDATION_RULES.SLUG_PATTERN.test(formData.slug)) {
    errors.slug = VALIDATION_RULES.ERRORS.SLUG_INVALID;
    isValid = false;
  }

  if (formData.audio_tracks.length === 0) {
    errors.audio_tracks = VALIDATION_RULES.ERRORS.TRACKS_REQUIRED;
    isValid = false;
  }

  return isValid;
};

// Mode management
const enterCreateMode = () => {
  isCreateMode.value = true;
  formData.title = "";
  formData.slug = "";
  formData.visible = true;
  formData.audio_tracks = [];
  isDirty.value = false;
  clearErrors();
};

const cancelCreateMode = () => {
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
    const fieldsToCheck = ["title", "color_key", "audio_file_url", "order"] as const;

    fieldsToCheck.forEach((field) => {
      if (track[field] !== originalTrack[field]) {
        (updateData as any)[field] = track[field];
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
  if (!validateForm() || !authStore.isAuthenticated || !currentCollection.value) {
    return;
  }

  isSaving.value = true;

  try {
    const { data: newSongData, error: songError } = await insertSong({
      collection_id: currentCollection.value.id,
      title: formData.title,
      slug: formData.slug,
      visible: formData.visible
    });

    if (songError) throw songError;
    if (!newSongData?.[0]) throw new Error("No se pudo crear la canción");

    const newSong = newSongData[0];
    await saveAudioTracks(newSong.id);
    await collectionsStore.fetchSongsByCollectionId(currentCollection.value.id);

    toast.success("Canción creada correctamente");
    isCreateMode.value = false;
    isDirty.value = false;
    replaceToSong(currentCollection.value, newSong);
  } catch (error: any) {
    console.error("Error creating song:", error);
    toast.error("Error al crear la canción: " + error.message);
  } finally {
    isSaving.value = false;
  }
};

const handleUpdateSong = async () => {
  if (
    !validateForm() ||
    !currentSong.value ||
    !authStore.isAuthenticated ||
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
      visible: formData.visible
    });

    if (songError) throw songError;

    await updateExistingTracks();
    await collectionsStore.fetchSongsByCollectionId(currentSong.value.collection_id);

    toast.success("Canción actualizada correctamente");
    isDirty.value = false;

    if (originalSlug !== formData.slug) {
      const updatedSong = { ...currentSong.value, slug: formData.slug };
      replaceToSong(currentCollection.value, updatedSong);
    }
  } catch (error: any) {
    console.error("Error saving song:", error);
    toast.error("Error al guardar la canción: " + error.message);
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

// Watchers
watch(
  currentSong,
  (song) => {
    if (song && !isCreateMode.value) {
      restoreFormFromSong(song);
    }
  },
  { immediate: true }
);

watch(
  () => ({ ...formData }),
  () => {
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
const colorOptions = computed(() =>
  Object.entries(currentCollection.value?.track_colors ?? {}).map(([key, value]) => ({
    key,
    value
  }))
);

const canSave = computed(() => authStore.isAuthenticated && isDirty.value && !isSaving.value);

const canCreateNewSong = computed(
  () => authStore.isAuthenticated && !isCreateMode.value && !isSaving.value
);

const tracksForRendering = computed(() =>
  formData.audio_tracks.map((track, index) => ({
    ...track,
    renderIndex: index,
    stableKey: `track-${Math.abs(track.id)}-${index}`
  }))
);

// Expose isDirty to parent component
defineExpose({
  isDirty
});
</script>

<template>
  <div class="h-full flex flex-col pl-3 pr-2">
    <div class="flex-1 flex flex-col pt-2 pb-3 gap-4">
      <div class="card bg-base-200 border border-base-300 shadow-sm">
        <div class="card-body p-5">
          <div class="flex items-start justify-between">
            <h3 class="text-base-content font-medium uppercase tracking-wide">
              Información básica
            </h3>
            <div class="form-control">
              <label class="label cursor-pointer justify-start gap-3">
                <div class="flex items-center gap-2">
                  <Eye v-if="formData.visible" class="size-4" />
                  <LockKeyhole v-else class="size-4" />
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
                class="input input-bordered flex items-center gap-2 w-full"
                :class="{ 'input-error': errors.title }"
              >
                <Music class="size-4 opacity-70" />
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

            <div class="form-control w-full">
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
                class="input input-bordered flex items-center gap-2 w-full"
                :class="{ 'input-error': errors.slug }"
              >
                <Hash class="size-4 opacity-70" />
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

      <div class="card bg-base-200 border border-base-300 shadow-sm">
        <div class="card-body p-5 gap-3">
          <div class="flex items-start justify-between">
            <h3 class="text-base-content font-medium uppercase tracking-wide">Tracks de audio</h3>
            <button class="btn btn-square btn-sm btn-soft -mt-1" @click="addAudioTrack">
              <Plus class="size-3.5" />
              <span class="sr-only">Agregar track</span>
            </button>
          </div>

          <div v-if="errors.audio_tracks" class="alert alert-error">
            <span class="text-sm">{{ errors.audio_tracks }}</span>
          </div>

          <div
            v-if="formData.audio_tracks.length === 0"
            class="text-center py-8 text-base-content/60"
          >
            <Music class="size-8 mx-auto mb-2 opacity-50" />
            <p>Aún no hay pistas de audio configuradas</p>
          </div>

          <div v-else class="flex flex-col gap-3">
            <div
              v-for="track in tracksForRendering"
              :key="track.stableKey"
              class="card bg-base-100 border border-base-300"
            >
              <div class="card-body p-4 flex flex-row items-center gap-3">
                <div class="flex flex-col shrink-0 join join-vertical -ml-1 -my-1">
                  <button
                    class="btn btn-xs btn-ghost btn-square join-item"
                    :disabled="track.renderIndex === 0"
                    @click="moveTrackUp(track.renderIndex)"
                  >
                    <ArrowUp class="size-3.5" />
                  </button>
                  <button
                    class="btn btn-xs btn-ghost btn-square join-item"
                    :disabled="track.renderIndex === formData.audio_tracks.length - 1"
                    @click="moveTrackDown(track.renderIndex)"
                  >
                    <ArrowDown class="size-3.5" />
                  </button>
                </div>

                <div class="flex flex-1 flex-row gap-2">
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

                  <div class="form-control flex-1">
                    <label class="label sr-only">Título de la pista</label>
                    <input
                      :value="formData.audio_tracks[track.renderIndex]!.title"
                      type="text"
                      placeholder="Título"
                      class="input input-bordered input-sm"
                      @input="handleTrackTitleInput(track.renderIndex, $event)"
                    />
                  </div>

                  <div class="form-control flex-3">
                    <label class="label sr-only">URL del audio</label>
                    <label
                      class="input input-bordered input-sm flex items-center gap-2 w-full"
                      :class="{ 'input-error': errors.slug }"
                    >
                      <Link2 class="size-4 opacity-70" />
                      <input
                        :value="formData.audio_tracks[track.renderIndex]!.audio_file_url"
                        type="url"
                        placeholder="URL"
                        class="grow font-mono"
                        @input="handleTrackUrlInput(track.renderIndex, $event)"
                      />
                    </label>
                  </div>

                  <AudioTrackUploader
                    v-if="currentCollection"
                    :track="formData.audio_tracks[track.renderIndex]!"
                    :collection="currentCollection"
                    :song="currentSong || { slug: formData.slug }"
                    :disabled="!formData.slug && isCreateMode"
                    @upload-start="handleUploadStart(track.renderIndex)"
                    @upload-end="handleUploadEnd"
                    @upload-success="(data: any) => handleUploadSuccess(track.renderIndex, data)"
                  />

                  <button
                    class="btn btn-sm btn-error btn-soft btn-square shrink-0"
                    @click="removeAudioTrack(track.renderIndex)"
                  >
                    <Trash2 class="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <SafeTeleport to="[data-song-editor-actions]">
    <div class="flex gap-2">
      <button v-if="isCreateMode" class="btn btn-xs btn-soft" @click="cancelCreateMode">
        <X class="size-3.5" />
        <span class="hidden md:block">Cancelar</span>
      </button>
      <button
        v-if="!isCreateMode"
        class="btn btn-xs btn-primary btn-soft"
        :disabled="!canCreateNewSong"
        @click="enterCreateMode"
      >
        <Plus class="size-3.5" />
        <span class="hidden md:block">Nueva canción</span>
      </button>
      <button class="btn btn-xs btn-primary" :disabled="!canSave" @click="handleSave">
        <template v-if="isSaving">
          <span class="loading loading-spinner loading-xs" />
          <span>{{ isCreateMode ? "Creando..." : "Guardando..." }}</span>
        </template>
        <template v-else>
          <Save class="size-3.5" />
          <span class="hidden md:block">{{
            isCreateMode ? "Crear canción" : "Guardar cambios"
          }}</span>
        </template>
      </button>
    </div>
  </SafeTeleport>
</template>
