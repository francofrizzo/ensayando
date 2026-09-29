<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";

import TrackRow, { type TrackUploadState } from "@/components/editor/TrackRow.vue";
import ConfirmTypedDialog from "@/components/settings/ConfirmTypedDialog.vue";
import SegmentedControl from "@/components/settings/SegmentedControl.vue";
import {
  IconChevronDown,
  IconHidden,
  IconPlus,
  IconTrash,
  IconUpload,
  IconVisible,
  IconWarning
} from "@/components/ui/icons";
import { useCollectionPalette } from "@/composables/useCollectionPalette";
import { useCurrentCollection } from "@/composables/useCurrentCollection";
import { useCurrentSong } from "@/composables/useCurrentSong";
import { useEditorTab } from "@/composables/useEditorSession";
import { AdminError, deleteSong } from "@/data/admin";
import { audioPlaybackUrl, deleteAudioFile, uploadAudioFile } from "@/data/storage";
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
import { generateTrackPeaks } from "@/utils/audio-utils";
import {
  isAudioFile,
  moveItem,
  nextColorKey,
  songFormChanges,
  titlesFromFilenames,
  tracksWithoutAudio,
  withOrder
} from "@/utils/songForm";
import {
  generateSlugFromTitle,
  RESERVED_SONG_SLUGS,
  songDurationFromTracks,
  validateSongForm
} from "@/utils/songUtils";

const { currentSong } = useCurrentSong();
const { currentCollection } = useCurrentCollection();
const router = useRouter();
const authStore = useAuthStore();
const collectionsStore = useCollectionsStore();
const { trackColor, colorOptions } = useCollectionPalette(currentCollection);

// ---------- form state ----------

const formData = reactive({
  title: "",
  slug: "",
  visible: true,
  audio_tracks: [] as AudioTrack[]
});

const isSaving = ref(false);
const isCreateMode = ref(false);
const trackKeyCounter = ref(0);
/** While true, the slug follows the title as it's typed. */
const slugFollowsTitle = ref(true);
const showAdvanced = ref(false);
const peaksGeneratingId = ref<number | null>(null);
const errors = reactive({ title: "", slug: "", audio_tracks: "" });

// Uploads, keyed by track id (negative for tracks not saved yet)
const uploads = reactive(new Map<number, TrackUploadState>());
const retryFiles = new Map<number, File>();
const fileInfo = reactive(new Map<number, { name: string; size: number }>());
/** Keys uploaded in this session and not saved yet: removed from R2 if they end up unused. */
const pendingUploadKeys = new Set<string>();

const isUploading = computed(() =>
  [...uploads.values()].some((u) => u.state === "uploading" || u.state === "peaks")
);

const clearErrors = () => {
  errors.title = "";
  errors.slug = "";
  errors.audio_tracks = "";
};

const sortTracksByOrder = (tracks: AudioTrack[]) =>
  [...tracks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

const restoreFormFromSong = (song: typeof currentSong.value) => {
  if (!song) return;
  formData.title = song.title;
  formData.slug = song.slug;
  formData.visible = song.visible;
  formData.audio_tracks = JSON.parse(JSON.stringify(sortTracksByOrder(song.audio_tracks)));
  slugFollowsTitle.value = song.slug === generateSlugFromTitle(song.title);
  uploads.clear();
  retryFiles.clear();
  clearErrors();
};

const isDirty = computed(() => {
  if (isCreateMode.value) {
    return !!(formData.title || formData.audio_tracks.length > 0);
  }
  const song = currentSong.value;
  return !!song && songFormChanges(formData, song).length > 0;
});

// ---------- title and address ----------

const onTitleInput = (value: string) => {
  formData.title = value;
  if (errors.title && value.trim()) errors.title = "";
  if (slugFollowsTitle.value) formData.slug = generateSlugFromTitle(value);
};

const onSlugInput = (value: string) => {
  formData.slug = value;
  slugFollowsTitle.value = value === generateSlugFromTitle(formData.title);
  errors.slug = (RESERVED_SONG_SLUGS as readonly string[]).includes(value)
    ? "Esa dirección está reservada. Probá con otra."
    : "";
};

const regenerateSlug = () => {
  onSlugInput(generateSlugFromTitle(formData.title));
  slugFollowsTitle.value = true;
};

const urlPrefix = computed(() => `${window.location.host}/${currentCollection.value?.slug ?? ""}/`);

type Visibility = "visible" | "oculta";
const visibility = computed<Visibility>({
  get: () => (formData.visible ? "visible" : "oculta"),
  set: (value) => (formData.visible = value === "visible")
});
const VISIBILITY_OPTIONS = [
  { value: "visible" as const, label: "Visible", icon: IconVisible },
  { value: "oculta" as const, label: "Oculta", icon: IconHidden }
];

// ---------- tracks ----------

const availableColorKeys = computed(() => colorOptions.value.map((o) => o.key));

const createTrack = (title = ""): AudioTrack => {
  trackKeyCounter.value++;
  return {
    id: -trackKeyCounter.value,
    song_id: currentSong.value?.id ?? 0,
    title,
    color_key: nextColorKey(
      formData.audio_tracks.map((t) => t.color_key),
      availableColorKeys.value
    ),
    audio_file_url: "",
    audio_file_key: null,
    peaks: null,
    order: formData.audio_tracks.length + 1,
    created_at: new Date().toISOString()
  };
};

const updateTrack = (id: number, changes: Partial<AudioTrack>) => {
  formData.audio_tracks = formData.audio_tracks.map((t) =>
    t.id === id ? { ...t, ...changes } : t
  );
};

const addEmptyTrack = () => {
  formData.audio_tracks = [...formData.audio_tracks, createTrack()];
};

const moveTrack = async (index: number, delta: number) => {
  const target = index + delta;
  formData.audio_tracks = withOrder(moveItem(formData.audio_tracks, index, target));
  await nextTick();
  // Keep focus on the handle that moved, for keyboard reordering
  document
    .querySelector<HTMLElement>(`[data-testid="track-row-${target}"] [data-testid="track-handle"]`)
    ?.focus();
};

// Undo is local: nothing is deleted from storage until the song is saved.
const removeTrack = (index: number) => {
  const track = formData.audio_tracks[index];
  if (!track) return;
  formData.audio_tracks = withOrder(formData.audio_tracks.filter((_, i) => i !== index));
  uploads.delete(track.id);
  toast(`Quitaste “${track.title || "la pista"}”`, {
    description: "El audio se borra recién al guardar.",
    duration: 8000,
    action: {
      label: "Deshacer",
      onClick: () => {
        const tracks = [...formData.audio_tracks];
        tracks.splice(Math.min(index, tracks.length), 0, track);
        formData.audio_tracks = withOrder(tracks);
      }
    }
  });
};

// ---------- uploads ----------

const uploadInto = async (trackId: number, file: File) => {
  const collection = currentCollection.value;
  if (!collection) return;
  if (!isAudioFile(file)) {
    uploads.set(trackId, {
      state: "error",
      fileName: file.name,
      message: "No es un archivo de audio. Probá con MP3, WAV, M4A, AAC, OGG o FLAC."
    });
    return;
  }

  retryFiles.set(trackId, file);
  uploads.set(trackId, { state: "uploading", progress: 0, fileName: file.name });
  try {
    const result = await uploadAudioFile(file, collection.id, (progress) => {
      if (uploads.get(trackId)?.state === "uploading") {
        uploads.set(trackId, { state: "uploading", progress, fileName: file.name });
      }
    });
    pendingUploadKeys.add(result.key);

    // The track may have been removed while it uploaded
    if (!formData.audio_tracks.some((t) => t.id === trackId)) {
      uploads.delete(trackId);
      return;
    }

    uploads.set(trackId, { state: "peaks", fileName: file.name });
    let peaks = null;
    try {
      peaks = await generateTrackPeaks(file);
    } catch (error) {
      console.warn("No se pudo generar la forma de onda:", error);
    }

    updateTrack(trackId, {
      audio_file_url: "",
      audio_file_key: result.key,
      playback_url: result.url,
      ...(peaks ? { peaks } : {})
    });
    fileInfo.set(trackId, { name: file.name, size: file.size });
    uploads.delete(trackId);
    retryFiles.delete(trackId);
    if (errors.audio_tracks) errors.audio_tracks = "";
  } catch (error) {
    console.error("Upload error:", error);
    uploads.set(trackId, {
      state: "error",
      fileName: file.name,
      message: error instanceof Error ? error.message : "No se pudo subir el audio."
    });
  }
};

const retryUpload = (trackId: number) => {
  const file = retryFiles.get(trackId);
  if (file) void uploadInto(trackId, file);
};

/** One new track per file, named from the file names. */
const addFiles = (files: File[]) => {
  const audio = files.filter(isAudioFile);
  if (audio.length < files.length) {
    toast.error(
      audio.length === 0
        ? "Esos archivos no son audio"
        : `${files.length - audio.length} archivos no son audio y quedaron afuera`
    );
  }
  if (audio.length === 0) return;

  const titles = titlesFromFilenames(
    audio.map((f) => f.name),
    formData.slug
  );
  const created = audio.map((_, i) => {
    const track = createTrack(titles[i]);
    formData.audio_tracks = [...formData.audio_tracks, track];
    return track;
  });
  created.forEach((track, i) => void uploadInto(track.id, audio[i]!));
};

const dropzoneInput = ref<HTMLInputElement | null>(null);
const dropzoneOver = ref(false);
let dropzoneDepth = 0;
const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;
const onDropzoneEnter = (event: DragEvent) => {
  if (!hasFiles(event)) return;
  dropzoneDepth++;
  dropzoneOver.value = true;
};
const onDropzoneLeave = (event: DragEvent) => {
  if (!hasFiles(event)) return;
  dropzoneDepth = Math.max(0, dropzoneDepth - 1);
  if (dropzoneDepth === 0) dropzoneOver.value = false;
};
const onDropzoneDrop = (event: DragEvent) => {
  dropzoneDepth = 0;
  dropzoneOver.value = false;
  addFiles(Array.from(event.dataTransfer?.files ?? []));
};
const onDropzonePick = (event: Event) => {
  const input = event.target as HTMLInputElement;
  addFiles(Array.from(input.files ?? []));
  input.value = "";
};

// ---------- reorder by dragging the handle ----------

const liftedId = ref<number | null>(null);
const onTrackDragStart = (event: DragEvent, id: number) => {
  liftedId.value = id;
  event.dataTransfer?.setData("application/x-ensayando-track", String(id));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
};
// Swapping on any dragover looped: the other card slid in under the pointer and
// swapped back. Only swap once the pointer passes the other card's middle in the
// direction of travel, measured on its layout box (the move animation transforms it).
const layoutMiddle = (element: HTMLElement) => {
  const parent = element.offsetParent as HTMLElement | null;
  const top = (parent?.getBoundingClientRect().top ?? 0) + element.offsetTop;
  return top + element.offsetHeight / 2;
};
const onTrackDragOver = (event: DragEvent, index: number) => {
  if (liftedId.value === null) return;
  event.preventDefault();
  const from = formData.audio_tracks.findIndex((t) => t.id === liftedId.value);
  if (from === -1 || from === index) return;
  const middle = layoutMiddle(event.currentTarget as HTMLElement);
  const passed = from < index ? event.clientY > middle : event.clientY < middle;
  if (passed) formData.audio_tracks = withOrder(moveItem(formData.audio_tracks, from, index));
};

// ---------- advanced ----------

const regeneratePeaks = async (track: AudioTrack) => {
  if (!audioPlaybackUrl(track)) return;
  peaksGeneratingId.value = track.id;
  try {
    const response = await fetch(audioPlaybackUrl(track), { cache: "no-store" });
    const blob = await response.blob();
    const file = new File([blob], `${track.title || "pista"}.audio`, {
      type: blob.type || "audio/mpeg"
    });
    updateTrack(track.id, { peaks: await generateTrackPeaks(file) });
    toast.success("Forma de onda generada");
  } catch (error) {
    console.error("Error generating peaks:", error);
    toast.error("No se pudo generar la forma de onda");
  } finally {
    peaksGeneratingId.value = null;
  }
};

const setTrackUrl = (track: AudioTrack, url: string) => {
  updateTrack(track.id, { audio_file_url: url, audio_file_key: null, playback_url: url });
  fileInfo.delete(track.id);
};

// ---------- storage cleanup ----------

const cleanupUploadedFiles = async (keys: string[]) => {
  const unique = [...new Set(keys)];
  const results = await Promise.allSettled(unique.map((key) => deleteAudioFile(key)));
  let failed = 0;
  results.forEach((result, i) => {
    if (result.status === "fulfilled") pendingUploadKeys.delete(unique[i]!);
    else {
      failed++;
      console.error("Error cleaning up audio file:", result.reason);
    }
  });
  // One notice for the whole batch; the files stay as orphans in storage
  if (failed > 0) {
    toast.warning(
      failed === 1
        ? "No se pudo borrar un audio que ya no se usa"
        : `No se pudieron borrar ${failed} audios que ya no se usan`
    );
  }
};

const cleanupPendingUploads = async () => {
  await cleanupUploadedFiles([...pendingUploadKeys]);
};

// ---------- modes ----------

const enterCreateMode = async () => {
  await cleanupPendingUploads();
  isCreateMode.value = true;
  formData.title = "";
  formData.slug = "";
  // New songs are born hidden until someone publishes them
  formData.visible = false;
  formData.audio_tracks = [];
  slugFollowsTitle.value = true;
  uploads.clear();
  clearErrors();
};

const discardChanges = async () => {
  await cleanupPendingUploads();
  if (isCreateMode.value) await enterCreateMode();
  else restoreFormFromSong(currentSong.value);
};

// ---------- validation and save ----------

const validateForm = () => {
  clearErrors();
  const result = validateSongForm(formData);
  Object.assign(errors, result.errors);
  const missing = tracksWithoutAudio(formData.audio_tracks);
  if (result.isValid && missing.length > 0) {
    const names = missing.map((t) => `“${t.title || "sin nombre"}”`).join(", ");
    errors.audio_tracks =
      missing.length === 1
        ? `A la pista ${names} le falta el audio.`
        : `A las pistas ${names} les falta el audio.`;
    return false;
  }
  return result.isValid;
};

const trackRow = (track: AudioTrack) => ({
  title: track.title,
  color_key: track.color_key,
  audio_file_url: track.audio_file_url,
  audio_file_key: track.audio_file_key ?? null,
  peaks: track.peaks ?? null,
  order: track.order
});

const insertNewTracks = async (songId: number) => {
  for (const track of formData.audio_tracks.filter((t) => t.id < 0)) {
    const { error } = await insertAudioTrack({ song_id: songId, ...trackRow(track) });
    if (error) throw error;
  }
};

const updateExistingTracks = async () => {
  const song = currentSong.value;
  if (!song) return;

  const formIds = new Set(formData.audio_tracks.filter((t) => t.id > 0).map((t) => t.id));
  const toDelete = song.audio_tracks.map((t) => t.id).filter((id) => !formIds.has(id));
  if (toDelete.length > 0) {
    const { error } = await deleteAudioTracks(toDelete);
    if (error) throw error;
  }

  for (const track of formData.audio_tracks.filter((t) => t.id > 0)) {
    const original = song.audio_tracks.find((t) => t.id === track.id);
    if (!original) continue;
    const next = trackRow(track);
    const changes = Object.fromEntries(
      Object.entries(next).filter(
        ([field, value]) =>
          JSON.stringify(value) !== JSON.stringify(original[field as keyof AudioTrack] ?? null)
      )
    );
    if (Object.keys(changes).length > 0) {
      const { error } = await updateAudioTrack(track.id, changes);
      if (error) throw error;
    }
  }

  await insertNewTracks(song.id);
};

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

const createSong = async () => {
  const collection = currentCollection.value;
  if (!collection) return;
  const { data, error } = await insertSong({
    collection_id: collection.id,
    title: formData.title,
    slug: formData.slug,
    visible: formData.visible,
    duration: songDurationFromTracks(formData.audio_tracks)
  });
  if (error) throw error;
  const song = data?.[0];
  if (!song) throw new Error("No se pudo crear la canción");

  await insertNewTracks(song.id);
  formData.audio_tracks.forEach(
    (t) => t.audio_file_key && pendingUploadKeys.delete(t.audio_file_key)
  );
  await cleanupPendingUploads();
  await collectionsStore.fetchSongsByCollectionId(collection.id);

  toast.success("Canción creada");
  isCreateMode.value = false;
  // Clean before navigating, so leaving /nueva doesn't ask about unsaved changes
  formData.title = "";
  formData.audio_tracks = [];
  await router.replace({
    name: "song",
    params: { collectionSlug: collection.slug, songSlug: song.slug },
    query: { editar: "letra" }
  });
};

const updateSong = async () => {
  const song = currentSong.value;
  const collection = currentCollection.value;
  if (!song || !collection) return;
  const originalSlug = song.slug;

  const { error } = await updateSongBasicInfo(song.id, {
    title: formData.title,
    slug: formData.slug,
    visible: formData.visible,
    duration: songDurationFromTracks(formData.audio_tracks)
  });
  if (error) throw error;

  await updateExistingTracks();

  // Audio replaced or removed: deleted from R2 only now that the song is saved
  const activeKeys = new Set(
    formData.audio_tracks.flatMap((t) => (t.audio_file_key ? [t.audio_file_key] : []))
  );
  const unusedSavedKeys = song.audio_tracks
    .flatMap((t) => (t.audio_file_key ? [t.audio_file_key] : []))
    .filter((key) => !activeKeys.has(key));
  activeKeys.forEach((key) => pendingUploadKeys.delete(key));
  await cleanupPendingUploads();
  await cleanupUploadedFiles(unusedSavedKeys);
  // Apply the change in place (this also keeps the old address resolving after a slug
  // change), then refresh tracks quietly: the player keeps playing and nothing reloads.
  collectionsStore.patchSong(song.id, {
    title: formData.title,
    slug: formData.slug,
    visible: formData.visible,
    duration: songDurationFromTracks(formData.audio_tracks)
  });
  await collectionsStore.fetchSongsByCollectionId(song.collection_id, { background: true });
  // Pick up what the database assigned (new track ids, order) now that nothing is pending.
  restoreFormFromSong(currentSong.value);

  toast.success("Cambios guardados");
  if (originalSlug !== formData.slug) {
    await router.replace({
      name: "song",
      params: { collectionSlug: collection.slug, songSlug: formData.slug },
      query: router.currentRoute.value.query
    });
  }
};

const handleSave = async () => {
  if (!authStore.isAuthenticated || !collectionsStore.canEditCurrentCollection) return;
  if (!validateForm()) {
    toast.error("Revisá los datos de la canción antes de guardar");
    return;
  }
  isSaving.value = true;
  try {
    if (isCreateMode.value) await createSong();
    else await updateSong();
  } catch (error) {
    console.error("Error saving song:", error);
    toast.error(
      isCreateMode.value ? "No se pudo crear la canción" : "No se pudo guardar la canción",
      { description: errorText(error) }
    );
  } finally {
    isSaving.value = false;
  }
};

// ---------- delete ----------

const isAdmin = computed(() => currentCollection.value?.user_role === "admin");
const deleteOpen = ref(false);
const deleting = ref(false);
const deleteError = ref("");

const confirmDelete = async () => {
  const song = currentSong.value;
  const collection = currentCollection.value;
  if (!song || !collection) return;
  deleting.value = true;
  deleteError.value = "";
  try {
    const result = await deleteSong(song.id);
    // Nothing left to save: leave without the unsaved-changes question
    restoreFormFromSong(song);
    collectionsStore.discardLyricsChanges();
    await cleanupPendingUploads();
    deleteOpen.value = false;
    if (result.orphanedKeys.length) {
      toast.warning(`Eliminaste “${song.title}”`, {
        description: `${result.orphanedKeys.length} archivos de audio no se pudieron borrar del almacenamiento.`
      });
    } else {
      toast.success(`Eliminaste “${song.title}”`);
    }
    await collectionsStore.fetchSongsByCollectionId(collection.id);
    await router.replace({ name: "collection", params: { collectionSlug: collection.slug } });
  } catch (error) {
    deleteError.value =
      error instanceof AdminError ? error.message : "No se pudo eliminar la canción.";
  } finally {
    deleting.value = false;
  }
};

const deleteDescription = computed(() => {
  const count = currentSong.value?.audio_tracks.length ?? 0;
  const tracks = count === 1 ? "la pista y su audio" : `las ${count} pistas y sus audios`;
  return `Se borran la letra, ${tracks}. Nadie de la colección va a poder volver a escucharla.`;
});

// ---------- lifecycle ----------

onBeforeUnmount(() => {
  void cleanupPendingUploads();
});

watch(
  currentSong,
  (song, previous) => {
    if (song && !isCreateMode.value) {
      const sameSong = previous?.id === song.id;
      // The same song refreshed (e.g. its lyrics were just saved) must not wipe edits
      // in progress here; our own save restores the form explicitly.
      if (sameSong && previous && songFormChanges(formData, previous).length > 0) return;
      if (!sameSong) void cleanupPendingUploads();
      restoreFormFromSong(song);
    } else if (!song && !isCreateMode.value) {
      void enterCreateMode();
    }
  },
  { immediate: true }
);

// The edit bar's Guardar / Descartar drive this form.
useEditorTab("cancion", {
  isDirty: () => isDirty.value,
  isSaving: () => isSaving.value,
  // Guardar waits for uploads to finish
  canSave: () => !isUploading.value,
  save: handleSave,
  discard: discardChanges
});

defineExpose({ isDirty, enterCreateMode });
</script>

<template>
  <div class="h-full overflow-y-auto" data-testid="song-tab">
    <div class="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-5 md:px-8 md:py-8">
      <!-- Song -->
      <section class="flex flex-col gap-5" aria-labelledby="song-details">
        <h2 id="song-details" class="sr-only">Datos de la canción</h2>

        <label class="flex flex-col gap-1.5">
          <span class="text-base-content/70 text-[12.5px] font-semibold">Título</span>
          <input
            :value="formData.title"
            type="text"
            placeholder="Título de la canción"
            class="input font-display w-full text-lg font-bold field-focus"
            :class="{ 'input-error': errors.title }"
            data-testid="song-title-input"
            @input="onTitleInput(($event.target as HTMLInputElement).value)"
          />
          <span v-if="errors.title" class="text-error text-xs">{{ errors.title }}</span>
        </label>

        <div class="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto]">
          <label class="flex min-w-0 flex-col gap-1.5">
            <span class="flex items-center justify-between gap-2">
              <span class="text-base-content/70 text-[12.5px] font-semibold">Dirección</span>
              <button
                v-if="!slugFollowsTitle && formData.title"
                type="button"
                class="link link-hover text-collection-ink text-xs font-semibold"
                @click="regenerateSlug"
              >
                Generar desde el título
              </button>
            </span>
            <span
              class="input flex w-full items-center gap-0 font-mono text-[13px] field-focus"
              :class="{ 'input-error': errors.slug }"
            >
              <span class="text-base-content/45 hidden shrink-0 sm:inline"
                >…/{{ currentCollection?.slug }}/</span
              >
              <input
                :value="formData.slug"
                type="text"
                placeholder="vidala-del-viento"
                class="min-w-0 grow"
                autocapitalize="none"
                spellcheck="false"
                data-testid="song-slug-input"
                @input="onSlugInput(($event.target as HTMLInputElement).value)"
              />
            </span>
            <span v-if="errors.slug" class="text-error text-xs">{{ errors.slug }}</span>
            <span v-else class="text-base-content/50 truncate text-xs">
              {{ urlPrefix }}{{ formData.slug || "…" }}
              <template v-if="slugFollowsTitle"> · se completa desde el título</template>
              <template
                v-else-if="!isCreateMode && currentSong && formData.slug !== currentSong.slug"
              >
                · los enlaces viejos dejan de funcionar
              </template>
            </span>
          </label>

          <div class="flex flex-col gap-1.5">
            <span class="text-base-content/70 text-[12.5px] font-semibold">Visibilidad</span>
            <SegmentedControl
              v-model="visibility"
              label="Visibilidad"
              :options="VISIBILITY_OPTIONS"
            />
            <span class="text-base-content/50 text-xs">
              <template v-if="formData.visible">La ve toda la colección.</template>
              <template v-else-if="isCreateMode">Oculta hasta que la publiques.</template>
              <template v-else>Oculta: solo la ven editores y admins.</template>
            </span>
          </div>
        </div>
      </section>

      <!-- Tracks -->
      <section class="flex flex-col gap-3" aria-labelledby="song-tracks">
        <div class="flex items-end justify-between gap-3">
          <h2 id="song-tracks" class="font-display text-lg font-bold">Pistas</h2>
          <button
            type="button"
            class="btn btn-sm bg-base-content/7 hover:bg-base-content/12 shrink-0 gap-1.5 rounded-full border-0 font-semibold shadow-none"
            data-testid="add-track"
            @click="addEmptyTrack"
          >
            <IconPlus class="size-4" />
            <span class="hidden sm:inline">Agregar pista</span>
          </button>
        </div>

        <div
          v-if="errors.audio_tracks"
          class="bg-error/10 text-error flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium"
          role="alert"
        >
          <IconWarning class="size-4 shrink-0" />
          {{ errors.audio_tracks }}
        </div>

        <TransitionGroup tag="div" name="track-list" class="flex flex-col gap-2.5">
          <TrackRow
            v-for="(track, index) in formData.audio_tracks"
            :key="track.id"
            :track="track"
            :index="index"
            :total="formData.audio_tracks.length"
            :fill="trackColor(track.color_key, 'fill')"
            :wave="trackColor(track.color_key, 'wave')"
            :color-options="colorOptions"
            :upload="uploads.get(track.id) ?? null"
            :file-info="fileInfo.get(track.id) ?? null"
            :show-advanced="showAdvanced"
            :lifted="liftedId === track.id"
            :generating-peaks="peaksGeneratingId === track.id"
            :title-error="!!errors.audio_tracks && !track.title"
            @title="(value: string) => updateTrack(track.id, { title: value })"
            @color="(key: string) => updateTrack(track.id, { color_key: key })"
            @replace="(file: File) => uploadInto(track.id, file)"
            @retry="retryUpload(track.id)"
            @remove="removeTrack(index)"
            @move="(delta: number) => moveTrack(index, delta)"
            @url="(value: string) => setTrackUrl(track, value)"
            @regenerate-peaks="regeneratePeaks(track)"
            @drag-start="(event: DragEvent) => onTrackDragStart(event, track.id)"
            @drag-end="liftedId = null"
            @dragover="onTrackDragOver($event, index)"
          />
        </TransitionGroup>

        <!-- Drop zone: one track per file -->
        <div
          class="rounded-box flex flex-col items-center gap-2 border-2 border-dashed px-4 py-6 text-center transition-colors"
          :class="
            dropzoneOver
              ? 'border-collection-ink bg-primary/10'
              : 'border-base-content/15 hover:border-base-content/30'
          "
          data-testid="track-dropzone"
          @dragenter="onDropzoneEnter"
          @dragover.prevent
          @dragleave="onDropzoneLeave"
          @drop.prevent="onDropzoneDrop"
        >
          <IconUpload class="text-base-content/50 size-6" />
          <p class="text-[13.5px]">
            <template v-if="dropzoneOver">Soltá para crear una pista por archivo</template>
            <template v-else>
              Soltá uno o varios audios o
              <button
                type="button"
                class="link link-hover text-collection-ink font-semibold"
                @click="dropzoneInput?.click()"
              >
                elegilos</button
              >.
            </template>
          </p>
          <p class="text-base-content/50 text-xs">
            Se crea una pista por archivo, con el nombre del archivo.
          </p>
          <input
            ref="dropzoneInput"
            type="file"
            multiple
            accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
            class="hidden"
            data-testid="track-files-input"
            @change="onDropzonePick"
          />
        </div>

        <button
          type="button"
          class="text-base-content/60 hover:text-base-content flex items-center gap-1.5 self-start text-[13px] font-semibold"
          :aria-expanded="showAdvanced"
          @click="showAdvanced = !showAdvanced"
        >
          <IconChevronDown
            class="size-4 transition-transform"
            :class="{ '-rotate-90': !showAdvanced }"
          />
          Opciones avanzadas
          <span class="text-base-content/45 font-normal">· URL del audio y forma de onda</span>
        </button>
      </section>

      <p v-if="isUploading" class="text-base-content/60 flex items-center gap-2 text-[13px]">
        <span class="loading loading-spinner loading-xs" />
        Guardar se habilita cuando terminen de subir los audios.
      </p>

      <!-- Danger zone: admins only -->
      <section
        v-if="isAdmin && !isCreateMode && currentSong"
        class="border-error/25 rounded-box flex flex-col gap-3 border p-4 md:flex-row md:items-center md:justify-between"
        aria-labelledby="song-danger"
      >
        <div class="flex flex-col gap-1">
          <h2 id="song-danger" class="text-error text-[13px] font-semibold">Zona de peligro</h2>
          <p class="text-[13.5px] font-semibold">Eliminar canción</p>
          <p class="text-base-content/60 text-[13px]">
            Se borran la letra, las pistas y sus audios. No se puede deshacer.
          </p>
        </div>
        <button
          type="button"
          class="btn btn-sm text-error bg-error/10 hover:bg-error/15 shrink-0 gap-1.5 self-start rounded-full border-0 font-semibold shadow-none md:self-center"
          data-testid="delete-song"
          @click="
            deleteError = '';
            deleteOpen = true;
          "
        >
          <IconTrash class="size-4" />
          Eliminar
        </button>
      </section>
    </div>

    <ConfirmTypedDialog
      :open="deleteOpen"
      :title="`¿Eliminar “${currentSong?.title ?? ''}”?`"
      :description="deleteDescription"
      :expected="currentSong?.title ?? ''"
      confirm-label="Eliminar canción"
      :busy="deleting"
      :error="deleteError"
      @confirm="confirmDelete"
      @cancel="deleteOpen = false"
    />
  </div>
</template>

<style scoped>
.track-list-move {
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}
</style>
