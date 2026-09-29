<script setup lang="ts">
import { computed, ref } from "vue";

import {
  IconWarning,
  IconCheck,
  IconDragHandle,
  IconRetry,
  IconTrash,
  IconUpload
} from "@/components/ui/icons";
import type { AudioTrack } from "@/data/types";
import { formatBytes, formatDuration, storedFileName } from "@/utils/songForm";

export type TrackUploadState =
  | { state: "uploading"; progress: number; fileName: string }
  | { state: "peaks"; fileName: string }
  | { state: "error"; message: string; fileName: string };

const props = defineProps<{
  track: AudioTrack;
  index: number;
  total: number;
  /** Swatch (fill) color of the track's color key. */
  fill: string;
  /** Wave color (ink of the track, per theme). */
  wave: string;
  colorOptions: { key: string; value: string }[];
  upload?: TrackUploadState | null;
  /** Name and size of a file uploaded in this session (not stored). */
  fileInfo?: { name: string; size: number } | null;
  showAdvanced: boolean;
  /** This row is the one being dragged to reorder. */
  lifted?: boolean;
  generatingPeaks?: boolean;
  titleError?: boolean;
}>();

const emit = defineEmits<{
  title: [value: string];
  color: [key: string];
  replace: [file: File];
  remove: [];
  retry: [];
  move: [delta: number];
  url: [value: string];
  "regenerate-peaks": [];
  "drag-start": [event: DragEvent];
  "drag-end": [];
}>();

// Mini waveform from the stored peaks: ~90 bars, first channel.
const BARS = 90;
const bars = computed(() => {
  const channel = props.track.peaks?.channels?.[0];
  if (!channel || channel.length === 0) return [];
  const max = Math.max(1, ...channel);
  const step = channel.length / BARS;
  return Array.from({ length: BARS }, (_, i) => {
    const slice = channel.slice(
      Math.floor(i * step),
      Math.max(Math.floor((i + 1) * step), Math.floor(i * step) + 1)
    );
    return Math.max(0.08, Math.max(...slice) / max);
  });
});

const duration = computed(() => props.track.peaks?.duration ?? null);
const hasAudio = computed(() => !!(props.track.audio_file_key || props.track.audio_file_url));

const fileLabel = computed(() => {
  if (props.upload) return props.upload.fileName;
  if (props.fileInfo) return props.fileInfo.name;
  const stored = props.track.audio_file_key || props.track.audio_file_url;
  if (stored) return storedFileName(stored) ?? "Audio cargado";
  return null;
});

const fileMeta = computed(() => {
  const parts: string[] = [];
  if (duration.value) parts.push(formatDuration(duration.value));
  if (props.fileInfo) parts.push(formatBytes(props.fileInfo.size));
  return parts.join(" · ");
});

// Replacing or picking audio for this row
const fileInput = ref<HTMLInputElement | null>(null);
const onFilePicked = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit("replace", file);
  input.value = "";
};

// A file dragged over the row replaces its audio
const fileOver = ref(false);
let fileDepth = 0;
const isFileDrag = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;
const onDragEnter = (event: DragEvent) => {
  if (!isFileDrag(event)) return;
  fileDepth++;
  fileOver.value = true;
};
const onDragLeave = (event: DragEvent) => {
  if (!isFileDrag(event)) return;
  fileDepth = Math.max(0, fileDepth - 1);
  if (fileDepth === 0) fileOver.value = false;
};
const onDrop = (event: DragEvent) => {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  event.stopPropagation();
  fileDepth = 0;
  fileOver.value = false;
  const file = event.dataTransfer?.files[0];
  if (file) emit("replace", file);
};

// Reorder: the row is draggable only while the handle is pressed
const draggable = ref(false);
const onHandleKeydown = (event: KeyboardEvent) => {
  if (!event.altKey) return;
  if (event.key === "ArrowUp" && props.index > 0) {
    event.preventDefault();
    emit("move", -1);
  } else if (event.key === "ArrowDown" && props.index < props.total - 1) {
    event.preventDefault();
    emit("move", 1);
  }
};

const colorOpen = ref(false);
const pickColor = (key: string) => {
  emit("color", key);
  colorOpen.value = false;
};
</script>

<template>
  <div
    class="bg-base-100 rounded-box ring-base-content/10 relative flex flex-col gap-3 p-3 ring-1 transition-shadow md:p-4"
    :class="{
      'ring-base-content/20 z-10 scale-[1.01] shadow-xl': props.lifted,
      'ring-primary ring-2': fileOver
    }"
    :draggable="draggable"
    :data-testid="`track-row-${props.index}`"
    @dragstart="emit('drag-start', $event)"
    @dragend="
      draggable = false;
      emit('drag-end');
    "
    @dragenter="onDragEnter"
    @dragover="isFileDrag($event) && $event.preventDefault()"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div class="flex items-center gap-2 md:gap-3">
      <button
        type="button"
        class="text-base-content/40 hover:text-base-content/70 focus-visible:text-base-content -ml-1 grid h-9 w-6 shrink-0 cursor-grab place-items-center rounded-md active:cursor-grabbing"
        :aria-label="`Mover ${props.track.title || 'pista'}. Con el teclado, ⌥↑ y ⌥↓.`"
        :title="'Arrastrá para ordenar (⌥↑ ⌥↓)'"
        data-testid="track-handle"
        @pointerdown="draggable = true"
        @pointerup="draggable = false"
        @keydown="onHandleKeydown"
      >
        <IconDragHandle class="size-[18px]" />
      </button>

      <!-- Color -->
      <div class="relative shrink-0">
        <button
          type="button"
          class="grid h-8 min-w-11 place-items-center rounded-lg px-2 font-mono text-xs font-semibold text-white"
          :style="{ background: props.fill }"
          :aria-label="`Color de la pista: ${props.track.color_key}`"
          :aria-expanded="colorOpen"
          data-testid="track-color"
          @click="colorOpen = !colorOpen"
        >
          {{ props.track.color_key }}
        </button>
        <div
          v-if="colorOpen"
          class="glass-3 rounded-box absolute top-full left-0 z-30 mt-2 flex w-64 flex-col gap-2.5 p-3"
          @keydown.esc="colorOpen = false"
        >
          <span class="text-base-content/60 text-[11px] font-semibold tracking-[0.1em] uppercase">
            Color de la pista
          </span>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="option in props.colorOptions"
              :key="option.key"
              type="button"
              class="flex h-8 min-w-11 items-center justify-center gap-1 rounded-lg px-2 font-mono text-xs font-semibold text-white"
              :class="{
                'ring-base-content ring-2 ring-offset-2 ring-offset-transparent':
                  option.key === props.track.color_key
              }"
              :style="{ background: option.value }"
              @click="pickColor(option.key)"
            >
              <IconCheck v-if="option.key === props.track.color_key" class="size-3.5" />
              {{ option.key }}
            </button>
          </div>
          <p class="text-base-content/60 text-xs">
            Los colores son los de la colección. Se cambian en Ajustes de la colección.
          </p>
        </div>
        <div v-if="colorOpen" class="fixed inset-0 z-20" @click="colorOpen = false" />
      </div>

      <input
        :value="props.track.title"
        type="text"
        placeholder="Nombre de la pista"
        aria-label="Nombre de la pista"
        class="input input-sm min-w-0 flex-1 font-semibold field-focus"
        :class="{ 'input-error': props.titleError }"
        data-testid="track-title"
        @input="emit('title', ($event.target as HTMLInputElement).value)"
      />

      <button
        type="button"
        class="btn btn-sm btn-circle btn-ghost text-error shrink-0"
        :aria-label="`Quitar ${props.track.title || 'pista'}`"
        title="Quitar pista"
        data-testid="track-remove"
        @click="emit('remove')"
      >
        <IconTrash class="size-[17px]" />
      </button>
    </div>

    <!-- The audio -->
    <div class="flex items-center gap-3 pl-5 md:pl-7">
      <div class="flex min-w-0 flex-1 flex-col gap-1.5">
        <template v-if="props.upload?.state === 'uploading'">
          <div class="flex items-center justify-between gap-2 text-[12.5px]">
            <span class="truncate font-medium">{{ props.upload.fileName }}</span>
            <span class="text-base-content/60 shrink-0 font-mono">
              Subiendo {{ Math.round(props.upload.progress * 100) }} %
            </span>
          </div>
          <progress
            class="progress progress-primary h-1.5"
            :value="Math.round(props.upload.progress * 100)"
            max="100"
          />
        </template>

        <template v-else-if="props.upload?.state === 'peaks'">
          <div class="flex items-center gap-2 text-[12.5px]">
            <span class="loading loading-spinner loading-xs" />
            <span class="truncate font-medium">{{ props.upload.fileName }}</span>
            <span class="text-base-content/60 shrink-0">· Generando forma de onda</span>
          </div>
        </template>

        <template v-else-if="props.upload?.state === 'error'">
          <div class="text-error flex items-center gap-2 text-[12.5px]" role="alert">
            <IconWarning class="size-4 shrink-0" />
            <span class="min-w-0 flex-1">
              <b class="font-semibold">{{ props.upload.fileName }}:</b> {{ props.upload.message }}
            </span>
            <button
              type="button"
              class="btn btn-xs btn-ghost gap-1 rounded-full"
              @click="emit('retry')"
            >
              <IconRetry class="size-3.5" /> Reintentar
            </button>
          </div>
        </template>

        <template v-else-if="hasAudio">
          <div class="flex items-center gap-3">
            <svg
              v-if="bars.length"
              class="h-7 min-w-0 flex-1"
              :viewBox="`0 0 ${BARS * 4} 28`"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <rect
                v-for="(bar, i) in bars"
                :key="i"
                :x="i * 4"
                :y="(28 - bar * 26) / 2"
                width="2.5"
                :height="bar * 26"
                rx="1.25"
                :fill="props.wave"
              />
            </svg>
            <span v-else class="text-base-content/50 min-w-0 flex-1 text-[12.5px]"
              >Sin forma de onda</span
            >
            <span class="flex shrink-0 flex-col items-end gap-0.5 text-right">
              <span class="max-w-40 truncate text-[12.5px] font-medium">{{ fileLabel }}</span>
              <span v-if="fileMeta" class="text-base-content/60 font-mono text-[11.5px]">{{
                fileMeta
              }}</span>
            </span>
          </div>
        </template>

        <template v-else>
          <span class="text-base-content/60 text-[12.5px]">
            Sin audio. Elegí un archivo o soltalo sobre la fila.
          </span>
        </template>
      </div>

      <input
        ref="fileInput"
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
        class="hidden"
        @change="onFilePicked"
      />
      <button
        v-if="props.upload?.state !== 'uploading' && props.upload?.state !== 'peaks'"
        type="button"
        class="btn btn-sm bg-base-content/7 hover:bg-base-content/12 shrink-0 gap-1.5 rounded-full border-0 font-semibold shadow-none"
        data-testid="track-replace"
        @click="fileInput?.click()"
      >
        <IconUpload class="size-4" />
        <span class="hidden sm:inline">{{ hasAudio ? "Reemplazar audio" : "Elegir audio" }}</span>
      </button>
    </div>

    <!-- Opciones avanzadas: URL and waveform, for special cases -->
    <div
      v-if="props.showAdvanced"
      class="border-base-content/10 ml-5 flex flex-col gap-3 border-t pt-3 md:ml-7"
    >
      <label class="flex flex-col gap-1.5">
        <span class="text-base-content/70 text-xs font-semibold">URL del audio</span>
        <input
          :value="props.track.audio_file_url"
          type="url"
          placeholder="https://…"
          class="input input-sm w-full font-mono text-xs field-focus"
          @change="emit('url', ($event.target as HTMLInputElement).value)"
        />
        <span class="text-base-content/50 text-xs">
          Solo para casos especiales. Lo normal es subir el archivo.
        </span>
      </label>
      <div class="flex items-center justify-between gap-3">
        <span class="flex flex-col gap-0.5">
          <span class="text-base-content/70 text-xs font-semibold">Forma de onda</span>
          <span class="text-base-content/50 text-xs">
            {{ props.track.peaks ? "Generada al subir." : "Todavía no se generó." }} Sirve volver a
            generarla si el audio se cambió por fuera.
          </span>
        </span>
        <button
          type="button"
          class="btn btn-xs bg-base-content/7 shrink-0 gap-1 rounded-full border-0 shadow-none"
          :disabled="!hasAudio || props.generatingPeaks"
          @click="emit('regenerate-peaks')"
        >
          <span v-if="props.generatingPeaks" class="loading loading-spinner loading-xs" />
          <IconRetry v-else class="size-3.5" />
          Volver a generar
        </button>
      </div>
    </div>

    <div
      v-if="fileOver"
      class="bg-primary/12 rounded-box pointer-events-none absolute inset-0 grid place-items-center"
    >
      <span class="badge badge-primary gap-1.5 px-3 py-3 font-semibold">
        <IconUpload class="size-4" /> Soltá para reemplazar el audio
      </span>
    </div>
  </div>
</template>
