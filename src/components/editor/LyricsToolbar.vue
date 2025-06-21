<script setup lang="ts">
import {
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Clock,
  Columns,
  Copy,
  ListPlus,
  PaintRoller,
  Trash2,
  X
} from "lucide-vue-next";
import { computed } from "vue";

import ColorPicker from "@/components/editor/ColorPicker.vue";
import TrackPicker from "@/components/editor/TrackPicker.vue";
import type { FocusPosition } from "@/composables/useLyricsEditor";
import type { AudioTrack } from "@/data/types";

interface Props {
  currentFocus: FocusPosition | null;
  onInsertStanza: () => void;
  onInsertLine: (before?: boolean) => void;
  onDuplicateLine: () => void;
  onDeleteLine: () => void;
  onInsertColumn: (before?: boolean) => void;
  onConvertToColumns: () => void;
  // Color operations
  currentVerseColors: string[];
  availableColors: { key: string; value: string }[];
  onColorsChange: (colors: string[]) => void;
  // Audio track operations
  currentVerseAudioTrackIds: number[];
  availableAudioTracks: AudioTrack[];
  onAudioTrackIdsChange: (trackIds: number[]) => void;
  // Unified copy properties operations
  copyPropertiesFromMode: boolean;
  onToggleCopyPropertiesFrom: () => void;
  // Timestamp visibility
  showTimestamps: boolean;
  onToggleTimestamps: () => void;
  // Timestamp operations
  onSetStartTime: () => void;
  onSetEndTime: () => void;
  onAdjustStartTime: (delta: number) => void;
  onAdjustEndTime: (delta: number) => void;
  onClearBothTimes: () => void;
}

const props = defineProps<Props>();

const hasColumnContext = computed(() => {
  return props.currentFocus?.columnIndex !== undefined;
});

const canPerformActions = computed(() => {
  return props.currentFocus !== null;
});

const isMac = navigator.platform.toLowerCase().includes("mac");
const modKey = isMac ? "⌘" : "Ctrl";
const altKey = isMac ? "⌥" : "Alt";
</script>

<template>
  <div
    class="flex justify-center self-center rounded-full shadow-sm gap-0.5 bg-base-200 border border-base-300/50 py-0.5 px-2"
  >
    <!-- Line operations -->
    <div class="tooltip tooltip-bottom">
      <div class="tooltip-content">
        Agregar verso después<br /><kbd class="kbd kbd-xs">Enter</kbd>
      </div>
      <button
        class="btn btn-xs btn-square btn-ghost"
        :disabled="!canPerformActions"
        @click="() => onInsertLine(false)"
      >
        <ArrowDownToLine class="size-3" />
        <span class="sr-only">Agregar verso después</span>
      </button>
    </div>

    <div class="tooltip tooltip-bottom">
      <div class="tooltip-content">
        Agregar verso antes<br /><kbd class="kbd kbd-xs">{{ altKey }}</kbd
        >+<kbd class="kbd kbd-xs">Enter</kbd>
      </div>
      <button
        class="btn btn-xs btn-square btn-ghost"
        :disabled="!canPerformActions"
        @click="() => onInsertLine(true)"
      >
        <ArrowUpToLine class="size-3" />
        <span class="sr-only">Agregar verso antes</span>
      </button>
    </div>

    <div class="tooltip tooltip-bottom">
      <div class="tooltip-content">
        Duplicar verso<br /><kbd class="kbd kbd-xs">{{ modKey }}</kbd
        >+<kbd class="kbd kbd-xs">D</kbd>
      </div>
      <button
        class="btn btn-xs btn-square btn-ghost"
        :disabled="!canPerformActions"
        @click="onDuplicateLine"
      >
        <Copy class="size-3" />
        <span class="sr-only">Duplicar verso</span>
      </button>
    </div>

    <!-- Column operations -->
    <div class="divider divider-horizontal mx-0"></div>

    <div v-if="!hasColumnContext" class="tooltip tooltip-bottom">
      <div class="tooltip-content">
        Convertir a columnas<br /><kbd class="kbd kbd-xs">{{ modKey }}</kbd
        >+<kbd class="kbd kbd-xs">\</kbd>
      </div>
      <button
        class="btn btn-xs btn-square btn-ghost"
        :disabled="!canPerformActions"
        @click="onConvertToColumns"
      >
        <Columns class="size-3" />
        <span class="sr-only">Convertir a columnas</span>
      </button>
    </div>

    <div v-if="hasColumnContext" class="tooltip tooltip-bottom">
      <div class="tooltip-content">
        Insertar columna a la izquierda<br /><kbd class="kbd kbd-xs">{{ modKey }}</kbd
        >+<kbd class="kbd kbd-xs">[</kbd>
      </div>
      <button class="btn btn-xs btn-square btn-ghost" @click="() => onInsertColumn(true)">
        <ArrowLeftToLine class="size-3" />
        <span class="sr-only">Insertar columna a la izquierda</span>
      </button>
    </div>

    <div v-if="hasColumnContext" class="tooltip tooltip-bottom">
      <div class="tooltip-content">
        Insertar columna a la derecha<br /><kbd class="kbd kbd-xs">{{ modKey }}</kbd
        >+<kbd class="kbd kbd-xs">]</kbd>
      </div>
      <button
        class="btn btn-xs btn-square btn-ghost"
        :disabled="!canPerformActions"
        @click="() => onInsertColumn(false)"
      >
        <ArrowRightToLine class="size-3" />
        <span class="sr-only">Insertar columna a la derecha</span>
      </button>
    </div>

    <!-- Color and audio track operations -->
    <div class="divider divider-horizontal mx-0"></div>

    <ColorPicker
      title="Colores del verso"
      :selected-colors="currentVerseColors"
      :available-colors="availableColors"
      :multiple="true"
      :disabled="!canPerformActions || copyPropertiesFromMode"
      btn-class="btn-xs"
      @update:selected-colors="onColorsChange"
    />

    <div class="tooltip tooltip-right">
      <div class="tooltip-content">Cambiar pistas de audio del verso</div>
      <TrackPicker
        :selected-track-ids="currentVerseAudioTrackIds"
        :available-tracks="availableAudioTracks"
        :available-colors="availableColors"
        :multiple="true"
        :disabled="!canPerformActions || copyPropertiesFromMode"
        btn-class="btn-xs"
        @update:selected-track-ids="onAudioTrackIdsChange"
      />
    </div>

    <div class="tooltip tooltip-bottom">
      <div class="tooltip-content">
        Copiar propiedades de otro verso<br /><kbd class="kbd kbd-xs">{{ modKey }}</kbd
        >+<kbd class="kbd kbd-xs">K</kbd>
      </div>
      <button
        class="btn btn-xs btn-square btn-ghost"
        :class="{ 'btn-active': copyPropertiesFromMode }"
        :disabled="!canPerformActions"
        @click="onToggleCopyPropertiesFrom"
      >
        <PaintRoller class="size-3" />
        <span class="sr-only">Copiar propiedades de otro verso</span>
      </button>
    </div>

    <!-- Timestamp visibility -->
    <div class="divider divider-horizontal mx-0"></div>

    <div class="tooltip tooltip-bottom">
      <div class="tooltip-content">Mostrar/ocultar marcas de tiempo</div>
      <button
        class="btn btn-xs btn-square"
        :class="{
          'btn-ghost': !showTimestamps,
          'btn-primary': showTimestamps,
          'btn-active': showTimestamps
        }"
        @click="onToggleTimestamps"
      >
        <Clock class="size-3" />
        <span class="sr-only">Mostrar/ocultar marcas de tiempo</span>
      </button>
    </div>

    <!-- Timestamp operations -->
    <div class="tooltip tooltip-bottom">
      <div class="tooltip-content">
        Establecer tiempo de inicio<br /><kbd class="kbd kbd-xs">{{ modKey }}</kbd
        >+<kbd class="kbd kbd-xs">Shift</kbd>+<kbd class="kbd kbd-xs">,</kbd>
      </div>
      <button
        class="btn btn-xs btn-square btn-ghost"
        :disabled="!canPerformActions"
        @click="onSetStartTime"
      >
        <ArrowLeftToLine class="size-3" />
        <span class="sr-only">Establecer tiempo de inicio</span>
      </button>
    </div>

    <div class="tooltip tooltip-bottom">
      <div class="tooltip-content">
        Establecer tiempo de finalización<br /><kbd class="kbd kbd-xs">{{ modKey }}</kbd
        >+<kbd class="kbd kbd-xs">Shift</kbd>+<kbd class="kbd kbd-xs">.</kbd>
      </div>
      <button
        class="btn btn-xs btn-square btn-ghost"
        :disabled="!canPerformActions"
        @click="onSetEndTime"
      >
        <ArrowRightToLine class="size-3" />
        <span class="sr-only">Establecer tiempo de finalización</span>
      </button>
    </div>

    <div class="tooltip tooltip-bottom">
      <div class="tooltip-content">
        Limpiar tiempos<br /><kbd class="kbd kbd-xs">{{ modKey }}</kbd
        >+<kbd class="kbd kbd-xs">{{ altKey }}</kbd
        >+<kbd class="kbd kbd-xs">/</kbd>
      </div>
      <button
        class="btn btn-xs btn-square btn-ghost"
        :disabled="!canPerformActions"
        @click="onClearBothTimes"
      >
        <X class="size-3" />
        <span class="sr-only">Limpiar ambos tiempos</span>
      </button>
    </div>

    <!-- Stanza operations -->
    <div class="divider divider-horizontal mx-0"></div>

    <div class="tooltip tooltip-bottom">
      <div class="tooltip-content">
        Agregar estrofa<br /><kbd class="kbd kbd-xs">{{ modKey }}</kbd
        >+<kbd class="kbd kbd-xs">Enter</kbd>
      </div>
      <button
        class="btn btn-xs btn-square btn-ghost"
        :disabled="!canPerformActions"
        @click="onInsertStanza"
      >
        <ListPlus class="size-3" />
        <span class="sr-only">Agregar estrofa</span>
      </button>
    </div>

    <!-- Delete line -->
    <div class="divider divider-horizontal mx-0"></div>

    <div class="tooltip tooltip-bottom">
      <div class="tooltip-content">
        Eliminar verso<br /><kbd class="kbd kbd-xs">{{ modKey }}</kbd
        >+<kbd class="kbd kbd-xs">⌫</kbd>
      </div>
      <button
        class="btn btn-xs btn-square btn-ghost"
        :disabled="!canPerformActions"
        @click="onDeleteLine"
      >
        <Trash2 class="size-3" />
        <span class="sr-only">Eliminar verso</span>
      </button>
    </div>
  </div>
</template>
