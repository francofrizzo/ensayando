<script setup lang="ts">
import { IconUpload } from "@/components/ui/icons";
import { ref } from "vue";
import { toast } from "vue-sonner";

import { uploadAudioFile as uploadAudioToStorage } from "@/data/storage";
import type { CollectionWithRole, TrackPeaks } from "@/data/types";
import { generateTrackPeaks } from "@/utils/audio-utils";

const props = defineProps<{
  collection: CollectionWithRole;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  "upload-success": [
    data: { key: string; url: string; suggestedTitle: string; peaks: TrackPeaks | null }
  ];
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

const uploadAudioFile = async (file: File) => {
  // Validate file type
  if (!validateAudioFile(file)) {
    toast.error("Por favor selecciona un archivo de audio válido");
    return;
  }

  isUploading.value = true;
  emit("upload-start");

  try {
    // Generate peaks client-side
    let peaks: TrackPeaks | null = null;
    try {
      peaks = await generateTrackPeaks(file);
    } catch (peaksError: unknown) {
      console.warn("No se pudieron generar los peaks automáticamente:", peaksError);
    }

    // Upload file to storage
    const result = await uploadAudioToStorage(file, props.collection.id);

    const suggestedTitle = file.name.replace(/\.[^/.]+$/, "");

    emit("upload-success", {
      key: result.key,
      url: result.url,
      suggestedTitle,
      peaks
    });

    toast.success("Archivo subido correctamente");
  } catch (error: unknown) {
    console.error("Upload error:", error);
    toast.error(error instanceof Error ? error.message : "Error al subir el archivo");
  } finally {
    isUploading.value = false;
    emit("upload-end");
  }
};

const handleFileUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (file) await uploadAudioFile(file);
  input.value = "";
};

const uploadDroppedFile = async (file: File) => {
  if (props.disabled || isUploading.value) return;
  await uploadAudioFile(file);
};

defineExpose({ uploadDroppedFile });
</script>

<template>
  <label
    class="btn btn-sm btn-soft relative shrink-0 cursor-pointer"
    :class="{ 'btn-disabled cursor-not-allowed': disabled || isUploading }"
  >
    <input
      type="file"
      accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
      class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      :disabled="disabled || isUploading"
      @change="handleFileUpload"
    />
    <template v-if="isUploading">
      <span class="loading loading-spinner loading-xs" />
      <span>Subiendo audio...</span>
    </template>
    <template v-else>
      <IconUpload class="size-3.5" />
      <span>Elegir audio</span>
    </template>
  </label>
</template>
