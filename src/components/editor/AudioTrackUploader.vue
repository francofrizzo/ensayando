<script setup lang="ts">
import { Upload } from "lucide-vue-next";
import { ref } from "vue";
import { toast } from "vue-sonner";

import { uploadFile } from "@/data/storage";
import type { AudioTrack, Collection, Song } from "@/data/types";

const props = defineProps<{
  track: AudioTrack;
  collection: Collection;
  song: Song | { slug: string };
  disabled?: boolean;
}>();

const emit = defineEmits<{
  "upload-success": [data: { url: string; suggestedTitle: string }];
  "upload-start": [];
  "upload-end": [];
}>();

const isUploading = ref(false);

// Audio file validation
const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/m4a",
  "audio/aac",
  "audio/ogg",
  "audio/flac"
];

const ALLOWED_EXTENSIONS = /\.(mp3|wav|m4a|aac|ogg|flac)$/i;

const validateAudioFile = (file: File): boolean => {
  return ALLOWED_AUDIO_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.test(file.name);
};

// Filename generation for audio tracks
const generateTrackFilename = (
  collection: Collection,
  song: Song | { slug: string },
  track: AudioTrack,
  originalFilename: string
): string => {
  const extension = originalFilename.split(".").pop()?.toLowerCase() || "mp3";
  const collectionSlug = collection.slug;
  const songSlug = song.slug;
  const trackId = Math.abs(track.id); // Use absolute value for negative temp IDs

  return `${collectionSlug}/${songSlug}-${trackId}.${extension}`;
};

const handleFileUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) return;

  // Validate file type
  if (!validateAudioFile(file)) {
    toast.error("Por favor selecciona un archivo de audio válido");
    return;
  }

  isUploading.value = true;
  emit("upload-start");

  try {
    const filename = generateTrackFilename(props.collection, props.song, props.track, file.name);
    const result = await uploadFile(file, filename, {
      bucket: "audio-files",
      addRandomSuffix: true
    });

    const suggestedTitle = file.name.replace(/\.[^/.]+$/, "");

    emit("upload-success", {
      url: result.url,
      suggestedTitle
    });

    toast.success("Archivo subido correctamente");
  } catch (error: any) {
    console.error("Upload error:", error);
    toast.error(error.message || "Error al subir el archivo");
  } finally {
    isUploading.value = false;
    emit("upload-end");
    input.value = "";
  }
};
</script>

<template>
  <div class="relative shrink-0">
    <input
      type="file"
      accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
      class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      :disabled="disabled || isUploading"
      @change="handleFileUpload"
    />
    <button class="btn btn-sm btn-soft btn-square" :disabled="disabled || isUploading">
      <template v-if="isUploading">
        <span class="loading loading-spinner loading-xs" />
      </template>
      <template v-else>
        <Upload class="size-3.5" />
      </template>
    </button>
  </div>
</template>
