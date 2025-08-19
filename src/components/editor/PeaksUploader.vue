<script setup lang="ts">
import { AudioLines } from "lucide-vue-next";
import { ref } from "vue";
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
}>();

const isUploading = ref(false);

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
</script>

<template>
  <div class="relative shrink-0">
    <input
      type="file"
      accept="application/json,.json"
      class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      :disabled="disabled || isUploading"
      @change="handleFileUpload"
    />
    <button class="btn btn-sm btn-soft btn-square" :disabled="disabled || isUploading">
      <template v-if="isUploading">
        <span class="loading loading-spinner loading-xs" />
      </template>
      <template v-else>
        <AudioLines class="size-3.5" />
      </template>
    </button>
  </div>
</template>
