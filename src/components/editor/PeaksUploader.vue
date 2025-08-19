<script setup lang="ts">
import { AudioLines, X } from "lucide-vue-next";
import { computed, ref } from "vue";
import { toast } from "vue-sonner";

import { uploadFile } from "@/data/storage";
import type { AudioTrack, CollectionWithRole, Song } from "@/data/types";

const props = defineProps<{
  track: AudioTrack;
  collection: CollectionWithRole;
  song: Song | { slug: string };
  disabled?: boolean;
}>();

const emit = defineEmits<{
  "upload-success": [data: { url: string; durationSeconds?: number }];
  "upload-start": [];
  "upload-end": [];
  "peaks-removed": [];
}>();

const isUploading = ref(false);
const isRemoving = ref(false);

// Check if peaks file exists
const hasPeaksFile = computed(() => {
  return !!(props.track.peaks_file_url && props.track.peaks_file_url.trim());
});

const generatePeaksFilename = (
  collection: CollectionWithRole,
  song: Song | { slug: string },
  track: AudioTrack,
  originalFilename: string
): string => {
  const collectionSlug = collection.slug;
  const songSlug = song.slug;
  const trackId = Math.abs(track.id);
  const base = originalFilename.replace(/\.[^/.]+$/, "");
  return `${collectionSlug}/${songSlug}-${trackId}.${base}.peaks.json`;
};

const handleFileUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!/\.json$/i.test(file.name)) {
    toast.error("Selecciona un archivo JSON válido");
    return;
  }

  isUploading.value = true;
  emit("upload-start");

  try {
    const filename = generatePeaksFilename(props.collection, props.song, props.track, file.name);
    const result = await uploadFile(file, filename, {
      bucket: "audio-files",
      addRandomSuffix: true
    });

    let durationSeconds: number | undefined;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (typeof json?.duration === "number") {
        durationSeconds = json.duration;
      }
    } catch (_) {
      // ignore parse errors
    }

    emit("upload-success", { url: result.url, durationSeconds });
    toast.success("Peaks subidos correctamente");
  } catch (error: any) {
    console.error("Peaks upload error:", error);
    toast.error(error.message || "Error al subir peaks");
  } finally {
    isUploading.value = false;
    emit("upload-end");
    if (input) input.value = "";
  }
};

const handleRemovePeaks = async () => {
  if (!hasPeaksFile.value) return;

  isRemoving.value = true;

  try {
    emit("peaks-removed");
    toast.success("Peaks eliminados correctamente");
  } catch (error: any) {
    console.error("Peaks removal error:", error);
    toast.error(error.message || "Error al eliminar peaks");
  } finally {
    isRemoving.value = false;
  }
};
</script>

<template>
  <div :class="hasPeaksFile ? 'join' : ''">
    <!-- Main peaks button -->
    <div class="relative">
      <input
        v-if="!hasPeaksFile"
        type="file"
        accept="application/json,.json"
        class="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        :disabled="disabled || isUploading"
        @change="handleFileUpload"
      />
      <div
        class="tooltip tooltip-top"
        :data-tip="hasPeaksFile ? 'Reemplazar archivo de peaks' : 'Subir archivo de peaks'"
      >
        <button
          class="btn btn-sm btn-square"
          :class="hasPeaksFile ? 'btn-primary join-item' : 'btn-soft'"
          :disabled="disabled || isUploading"
          @click="hasPeaksFile ? ($refs.fileInput as any)?.click() : undefined"
        >
          <template v-if="isUploading">
            <span class="loading loading-spinner loading-xs" />
          </template>
          <template v-else>
            <AudioLines class="size-3.5" />
          </template>
        </button>
      </div>

      <!-- Hidden file input for replace functionality -->
      <input
        v-if="hasPeaksFile"
        ref="fileInput"
        type="file"
        accept="application/json,.json"
        class="hidden"
        :disabled="disabled || isUploading"
        @change="handleFileUpload"
      />
    </div>

    <!-- Remove button (only when peaks exist) -->
    <div v-if="hasPeaksFile" class="tooltip tooltip-top" data-tip="Eliminar archivo de peaks">
      <button
        class="btn btn-sm btn-soft btn-square join-item opacity-80 hover:opacity-100"
        :disabled="disabled || isRemoving"
        @click="handleRemovePeaks"
      >
        <template v-if="isRemoving">
          <span class="loading loading-spinner loading-xs" />
        </template>
        <template v-else>
          <X class="size-3" />
        </template>
      </button>
    </div>
  </div>
</template>
