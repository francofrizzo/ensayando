<script setup lang="ts">
import type { FocusPosition } from "@/composables/useLyricsEditor";
import {
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Clock,
  Columns,
  Copy,
  Droplet,
  ListPlus,
  Trash2
} from "lucide-vue-next";
import { computed } from "vue";

import ColorPicker from "@/components/ui/ColorPicker.vue";

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
  copyColorFromMode: boolean;
  onColorsChange: (colors: string[]) => void;
  onToggleCopyColorFrom: () => void;
  // Timestamp visibility
  showTimestamps: boolean;
  onToggleTimestamps: () => void;
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
    <div class="lg:tooltip lg:tooltip-bottom">
      <div class="tooltip-content">Agregar verso después • <kbd class="kbd kbd-xs">Enter</kbd></div>
      <button
        class="btn btn-xs btn-circle btn-ghost"
        :disabled="!canPerformActions"
        @click="() => onInsertLine(false)"
      >
        <ArrowDownToLine class="size-3" />
        <span class="sr-only">Agregar verso después</span>
      </button>
    </div>

    <div class="lg:tooltip lg:tooltip-bottom">
      <div class="tooltip-content">
        Agregar verso antes • <kbd class="kbd kbd-xs">{{ altKey }}</kbd
        >+<kbd class="kbd kbd-xs">Enter</kbd>
      </div>
      <button
        class="btn btn-xs btn-circle btn-ghost"
        :disabled="!canPerformActions"
        @click="() => onInsertLine(true)"
      >
        <ArrowUpToLine class="size-3" />
        <span class="sr-only">Agregar verso antes</span>
      </button>
    </div>

    <div class="lg:tooltip lg:tooltip-bottom">
      <div class="tooltip-content">
        Duplicar verso • <kbd class="kbd kbd-xs">{{ modKey }}</kbd
        >+<kbd class="kbd kbd-xs">D</kbd>
      </div>
      <button
        class="btn btn-xs btn-circle btn-ghost"
        :disabled="!canPerformActions"
        @click="onDuplicateLine"
      >
        <Copy class="size-3" />
        <span class="sr-only">Duplicar verso</span>
      </button>
    </div>

    <!-- Column operations -->
    <div class="divider divider-horizontal mx-0"></div>

    <div v-if="!hasColumnContext" class="lg:tooltip lg:tooltip-bottom">
      <div class="tooltip-content">
        Convertir a columnas • <kbd class="kbd kbd-xs">{{ modKey }}</kbd
        >+<kbd class="kbd kbd-xs">\</kbd>
      </div>
      <button
        class="btn btn-xs btn-circle btn-ghost"
        :disabled="!canPerformActions"
        @click="onConvertToColumns"
      >
        <Columns class="size-3" />
        <span class="sr-only">Convertir a columnas</span>
      </button>
    </div>

    <div v-if="hasColumnContext" class="lg:tooltip lg:tooltip-bottom">
      <div class="tooltip-content">
        Insertar columna a la izquierda • <kbd class="kbd kbd-xs">{{ modKey }}</kbd
        >+<kbd class="kbd kbd-xs">[</kbd>
      </div>
      <button class="btn btn-xs btn-circle btn-ghost" @click="() => onInsertColumn(true)">
        <ArrowLeftToLine class="size-3" />
        <span class="sr-only">Insertar columna a la izquierda</span>
      </button>
    </div>

    <div v-if="hasColumnContext" class="lg:tooltip lg:tooltip-bottom">
      <div class="tooltip-content">
        Insertar columna a la derecha • <kbd class="kbd kbd-xs">{{ modKey }}</kbd
        >+<kbd class="kbd kbd-xs">]</kbd>
      </div>
      <button
        class="btn btn-xs btn-circle btn-ghost"
        :disabled="!canPerformActions"
        @click="() => onInsertColumn(false)"
      >
        <ArrowRightToLine class="size-3" />
        <span class="sr-only">Insertar columna a la derecha</span>
      </button>
    </div>

    <!-- Color operations -->
    <div class="divider divider-horizontal mx-0"></div>

    <div class="lg:tooltip lg:tooltip-bottom">
      <div class="tooltip-content">Cambiar colores del verso</div>
      <ColorPicker
        :selected-colors="currentVerseColors"
        :available-colors="availableColors"
        :multiple="true"
        :disabled="!canPerformActions"
        btn-class="btn-xs"
        @update:selected-colors="onColorsChange"
      />
    </div>

    <div class="lg:tooltip lg:tooltip-bottom">
      <div class="tooltip-content">Copiar color de otro verso</div>
      <button
        class="btn btn-xs btn-circle btn-ghost"
        :class="{ 'btn-active': copyColorFromMode }"
        :disabled="!canPerformActions"
        @click="onToggleCopyColorFrom"
      >
        <Droplet class="size-3" />
        <span class="sr-only">Copiar color de otro verso</span>
      </button>
    </div>

    <!-- Timestamp visibility -->
    <div class="divider divider-horizontal mx-0"></div>

    <div class="lg:tooltip lg:tooltip-bottom">
      <div class="tooltip-content">Mostrar/ocultar marcas de tiempo</div>
      <button
        class="btn btn-xs btn-circle btn-ghost"
        :class="{ 'btn-active': showTimestamps }"
        @click="onToggleTimestamps"
      >
        <Clock class="size-3" />
        <span class="sr-only">Mostrar/ocultar marcas de tiempo</span>
      </button>
    </div>

    <!-- Stanza operations -->
    <div class="divider divider-horizontal mx-0"></div>

    <div class="lg:tooltip lg:tooltip-bottom">
      <div class="tooltip-content">
        Agregar estrofa • <kbd class="kbd kbd-xs">{{ modKey }}</kbd
        >+<kbd class="kbd kbd-xs">Enter</kbd>
      </div>
      <button
        class="btn btn-xs btn-circle btn-ghost"
        :disabled="!canPerformActions"
        @click="onInsertStanza"
      >
        <ListPlus class="size-3" />
        <span class="sr-only">Agregar estrofa</span>
      </button>
    </div>

    <!-- Delete line -->
    <div class="divider divider-horizontal mx-0"></div>

    <div class="lg:tooltip lg:tooltip-bottom">
      <div class="tooltip-content">
        Eliminar verso • <kbd class="kbd kbd-xs">{{ modKey }}</kbd
        >+<kbd class="kbd kbd-xs">⌫</kbd>
      </div>
      <button
        class="btn btn-xs btn-circle btn-ghost"
        :disabled="!canPerformActions"
        @click="onDeleteLine"
      >
        <Trash2 class="size-3" />
        <span class="sr-only">Eliminar verso</span>
      </button>
    </div>
  </div>
</template>
