<script setup lang="ts">
import { useCurrentCollection } from "@/composables/useCurrentCollection";
import { useCurrentSong } from "@/composables/useCurrentSong";
import { useNavigation } from "@/composables/useNavigation";
import {
  deleteAudioTracks,
  insertAudioTrack,
  updateAudioTrack,
  updateSongBasicInfo
} from "@/data/supabase";
import type { AudioTrack } from "@/data/types";
import { useAuthStore } from "@/stores/auth";
import { useCollectionsStore } from "@/stores/collections";
import { selectMostContrasting } from "@/utils/utils";
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
  Trash2
} from "lucide-vue-next";
import { computed, nextTick, reactive, ref, watch } from "vue";
import { toast } from "vue-sonner";
import SafeTeleport from "../ui/SafeTeleport.vue";

const { currentSong } = useCurrentSong();
const { currentCollection } = useCurrentCollection();
const { replaceToSong } = useNavigation();
const authStore = useAuthStore();
const collectionsStore = useCollectionsStore();

const formData = reactive({
  title: "",
  slug: "",
  visible: true,
  audio_tracks: [] as AudioTrack[]
});

const isSaving = ref(false);
const isDirty = ref(false);
const trackKeyCounter = ref(0);
const errors = reactive({
  title: "",
  slug: "",
  audio_tracks: ""
});

const clearErrors = () => {
  errors.title = "";
  errors.slug = "";
  errors.audio_tracks = "";
};

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

const updateTrackAtIndex = (index: number, updates: Partial<AudioTrack>) => {
  const newTracks = [...formData.audio_tracks];
  newTracks[index] = { ...newTracks[index]!, ...updates };
  formData.audio_tracks = newTracks;
};

const validateForm = () => {
  clearErrors();
  let isValid = true;

  if (!formData.title.trim()) {
    errors.title = "El título es obligatorio";
    isValid = false;
  }

  if (!formData.slug.trim()) {
    errors.slug = "El slug es obligatorio";
    isValid = false;
  } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
    errors.slug = "El slug solo puede contener letras minúsculas, números y guiones";
    isValid = false;
  }

  if (formData.audio_tracks.length === 0) {
    errors.audio_tracks = "Debe haber al menos una pista de audio";
    isValid = false;
  }

  return isValid;
};

const handleTitleBlur = () => {
  if (!formData.slug) {
    generateSlugFromTitle();
  }
};

const handleTrackTitleInput = (index: number, event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  formData.audio_tracks[index]!.title = value;
};

const handleTrackUrlInput = (index: number, event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  formData.audio_tracks[index]!.audio_file_url = value;
};

const handleColorChange = (index: number, colorKey: string) => {
  formData.audio_tracks[index]!.color_key = colorKey;
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

const addAudioTrack = () => {
  const newTrack = createNewTrack();
  formData.audio_tracks = [...formData.audio_tracks, newTrack];
};

const removeAudioTrack = (index: number) => {
  const newTracks = formData.audio_tracks.filter((_, i) => i !== index);
  formData.audio_tracks = newTracks.map((track, i) => ({
    ...track,
    order: i + 1
  }));
};

const moveTrackUp = async (index: number) => {
  if (index > 0 && index < formData.audio_tracks.length) {
    const newTracks = [...formData.audio_tracks];
    const temp = newTracks[index]!;
    newTracks[index] = newTracks[index - 1]!;
    newTracks[index - 1] = temp;

    formData.audio_tracks = newTracks.map((track, i) => ({
      ...track,
      order: i + 1
    }));

    await nextTick();
  }
};

const moveTrackDown = async (index: number) => {
  if (index >= 0 && index < formData.audio_tracks.length - 1) {
    const newTracks = [...formData.audio_tracks];
    const temp = newTracks[index]!;
    newTracks[index] = newTracks[index + 1]!;
    newTracks[index + 1] = temp;

    formData.audio_tracks = newTracks.map((track, i) => ({
      ...track,
      order: i + 1
    }));

    await nextTick();
  }
};

const handleSave = async () => {
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

    const existingTrackIds = currentSong.value.audio_tracks.map((t) => t.id);
    const formTrackIds = formData.audio_tracks.filter((t) => t.id > 0).map((t) => t.id);
    const tracksToDelete = existingTrackIds.filter((id) => !formTrackIds.includes(id));

    if (tracksToDelete.length > 0) {
      const { error: deleteError } = await deleteAudioTracks(tracksToDelete);

      if (deleteError) throw deleteError;
    }

    for (const track of formData.audio_tracks) {
      if (track.id < 0) {
        const { error: insertError } = await insertAudioTrack({
          song_id: currentSong.value.id,
          title: track.title,
          color_key: track.color_key,
          audio_file_url: track.audio_file_url,
          order: track.order
        });

        if (insertError) throw insertError;
      } else {
        const originalTrack = currentSong.value.audio_tracks.find((t) => t.id === track.id);
        if (!originalTrack) {
          continue;
        }

        const updateData: Partial<AudioTrack> = {};

        if (track.title !== originalTrack.title) {
          updateData.title = track.title;
        }
        if (track.color_key !== originalTrack.color_key) {
          updateData.color_key = track.color_key;
        }
        if (track.audio_file_url !== originalTrack.audio_file_url) {
          updateData.audio_file_url = track.audio_file_url;
        }
        if (track.order !== originalTrack.order) {
          updateData.order = track.order;
        }

        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await updateAudioTrack(track.id, updateData);

          if (updateError) throw updateError;
        }
      }
    }

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

watch(
  currentSong,
  (song) => {
    if (song) {
      formData.title = song.title;
      formData.slug = song.slug;
      formData.visible = song.visible;
      formData.audio_tracks = JSON.parse(
        JSON.stringify([...song.audio_tracks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
      );
      isDirty.value = false;
      clearErrors();
    }
  },
  { immediate: true }
);

watch(
  () => ({ ...formData }),
  () => {
    if (currentSong.value) {
      const titleChanged = formData.title !== currentSong.value.title;
      const slugChanged = formData.slug !== currentSong.value.slug;
      const visibleChanged = formData.visible !== currentSong.value.visible;
      const tracksChanged =
        JSON.stringify(formData.audio_tracks) !==
        JSON.stringify(
          [...currentSong.value.audio_tracks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        );

      isDirty.value = titleChanged || slugChanged || visibleChanged || tracksChanged;
    }
  },
  { deep: true }
);

const colorOptions = computed((): { key: string; value: string }[] => {
  if (currentCollection.value?.track_colors) {
    return Object.entries(currentCollection.value.track_colors).map(([key, value]) => ({
      key,
      value
    }));
  } else {
    return [];
  }
});

const getColorStyle = (colorKey: string) => {
  const value = currentCollection.value?.track_colors?.[colorKey];
  return {
    backgroundColor: value,
    color: value ? selectMostContrasting(value, ["#ffffff", "#000000"]) : undefined
  };
};

const canSave = computed(() => {
  return authStore.isAuthenticated && isDirty.value && !isSaving.value;
});

const tracksForRendering = computed(() => {
  return formData.audio_tracks.map((track, index) => ({
    ...track,
    renderIndex: index,
    stableKey: `track-${Math.abs(track.id)}-${index}`
  }));
});
</script>

<template>
  <div class="h-full flex flex-col py-2 pl-3 pr-1">
    <div class="flex-1 flex flex-col gap-4">
      <div class="card bg-base-200 border border-base-300 shadow-sm">
        <div class="card-body">
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

      <div class="card bg-base-200 shadow-sm">
        <div class="card-body gap-3">
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
              class="card bg-base-100 shadow-sm border border-base-300"
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
                    <div class="dropdown">
                      <div
                        :style="getColorStyle(formData.audio_tracks[track.renderIndex]!.color_key)"
                        tabindex="0"
                        role="button"
                        class="btn btn-sm btn-square gap-0"
                      >
                        {{ formData.audio_tracks[track.renderIndex]!.color_key }}
                      </div>
                      <div
                        tabindex="0"
                        class="dropdown-content menu shadow-lg bg-base-100 min-w-max rounded-box border border-base-300"
                      >
                        <div class="grid grid-cols-4 gap-2 p-2 min-w-fit">
                          <div
                            v-for="color in colorOptions"
                            :key="color.value"
                            class="flex-shrink-0"
                          >
                            <button
                              type="button"
                              class="w-6 h-6 rounded-field text-xs font-medium hover:scale-110 transition-transform duration-200 cursor-pointer flex-shrink-0"
                              :style="getColorStyle(color.key)"
                              @click="handleColorChange(track.renderIndex, color.key)"
                            >
                              {{ color.key }}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
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
                </div>

                <div class="shrink-0">
                  <button
                    class="btn btn-sm btn-error btn-soft btn-square"
                    @click="removeAudioTrack(track.renderIndex)"
                  >
                    <Trash2 class="size-3" />
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
    <button class="btn btn-xs btn-primary" :disabled="!canSave" @click="handleSave">
      <template v-if="isSaving">
        <span class="loading loading-spinner loading-xs" />
        <span>Guardando...</span>
      </template>
      <template v-else>
        <Save class="size-3.5" />
        <span class="hidden md:block">Guardar cambios</span>
      </template>
    </button>
  </SafeTeleport>
</template>
