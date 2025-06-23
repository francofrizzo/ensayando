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
import KeybindingDisplay from "@/components/ui/KeybindingDisplay.vue";
import type { CommandRegistry } from "@/composables/useCommands";
import type { FocusPosition } from "@/composables/useLyricsEditor";
import type { AudioTrack } from "@/data/types";

type Props = {
  currentFocus: FocusPosition | null;
  commandRegistry: CommandRegistry;
  // Color operations
  currentVerseColors: string[];
  availableColors: { key: string; value: string }[];
  onColorsChange: (colors: string[]) => void;
  // Audio track operations
  currentVerseAudioTrackIds: number[];
  availableAudioTracks: AudioTrack[];
  onAudioTrackIdsChange: (trackIds: number[]) => void;
  // Copy properties mode
  copyPropertiesToMode: boolean;
  // Timestamp visibility
  showTimestamps: boolean;
  onToggleTimestamps: () => void;
};

const props = defineProps<Props>();

const hasColumnContext = computed(() => {
  return props.currentFocus?.columnIndex !== undefined;
});

const canPerformActions = computed(() => {
  return props.currentFocus !== null;
});

const getCommand = (commandId: string) => {
  return props.commandRegistry.getCommand(commandId);
};

const executeCommand = (commandId: string) => {
  const command = getCommand(commandId);
  if (command && (!command.canExecute || command.canExecute())) {
    command.execute();
  }
};

const getKeybindingParts = (commandId: string): string[] => {
  const command = getCommand(commandId);
  return command ? props.commandRegistry.getKeybindingParts(command) : [];
};
</script>

<template>
  <div
    class="bg-base-100/50 border-base-content/10 rounded-box mx-3 flex flex-wrap justify-center gap-0.5 self-center border px-2 py-0.5 backdrop-blur-sm"
  >
    <!-- Line operations -->
    <div class="tooltip tooltip-bottom">
      <div class="tooltip-content flex flex-col items-center gap-0.5">
        Agregar verso después<br />
        <KeybindingDisplay :key-parts="getKeybindingParts('insert-line')" kbd-class="kbd-xs" />
      </div>
      <button
        class="btn btn-xs btn-square btn-ghost"
        :disabled="!canPerformActions"
        @click="() => executeCommand('insert-line')"
      >
        <ArrowDownToLine class="size-3" />
        <span class="sr-only">Agregar verso después</span>
      </button>
    </div>

    <div class="tooltip tooltip-bottom">
      <div class="tooltip-content flex flex-col items-center gap-0.5">
        Agregar verso antes<br />
        <KeybindingDisplay :key-parts="getKeybindingParts('insert-line-before')" k />
      </div>
      <button
        class="btn btn-xs btn-square btn-ghost"
        :disabled="!canPerformActions"
        @click="() => executeCommand('insert-line-before')"
      >
        <ArrowUpToLine class="size-3" />
        <span class="sr-only">Agregar verso antes</span>
      </button>
    </div>

    <div class="tooltip tooltip-bottom">
      <div class="tooltip-content flex flex-col items-center gap-0.5">
        Duplicar verso<br />
        <KeybindingDisplay :key-parts="getKeybindingParts('duplicate-line')" k />
      </div>
      <button
        class="btn btn-xs btn-square btn-ghost"
        :disabled="!canPerformActions"
        @click="() => executeCommand('duplicate-line')"
      >
        <Copy class="size-3" />
        <span class="sr-only">Duplicar verso</span>
      </button>
    </div>

    <!-- Column operations -->
    <div class="divider divider-horizontal mx-0"></div>

    <div v-if="!hasColumnContext" class="tooltip tooltip-bottom">
      <div class="tooltip-content flex flex-col items-center gap-0.5">
        Convertir a columnas<br />
        <KeybindingDisplay :key-parts="getKeybindingParts('convert-to-columns')" k />
      </div>
      <button
        class="btn btn-xs btn-square btn-ghost"
        :disabled="!canPerformActions"
        @click="() => executeCommand('convert-to-columns')"
      >
        <Columns class="size-3" />
        <span class="sr-only">Convertir a columnas</span>
      </button>
    </div>

    <div v-if="hasColumnContext" class="tooltip tooltip-bottom">
      <div class="tooltip-content flex flex-col items-center gap-0.5">
        Insertar columna a la izquierda<br />
        <KeybindingDisplay :key-parts="getKeybindingParts('insert-column-left')" k />
      </div>
      <button
        class="btn btn-xs btn-square btn-ghost"
        :disabled="!canPerformActions"
        @click="() => executeCommand('insert-column-left')"
      >
        <ArrowLeftToLine class="size-3" />
        <span class="sr-only">Insertar columna a la izquierda</span>
      </button>
    </div>

    <div v-if="hasColumnContext" class="tooltip tooltip-bottom">
      <div class="tooltip-content flex flex-col items-center gap-0.5">
        Insertar columna a la derecha<br />
        <KeybindingDisplay :key-parts="getKeybindingParts('insert-column-right')" k />
      </div>
      <button
        class="btn btn-xs btn-square btn-ghost"
        :disabled="!canPerformActions"
        @click="() => executeCommand('insert-column-right')"
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
      :disabled="!canPerformActions || copyPropertiesToMode"
      btn-class="btn-xs"
      @update:selected-colors="onColorsChange"
    />

    <TrackPicker
      :selected-track-ids="currentVerseAudioTrackIds"
      :available-tracks="availableAudioTracks"
      :available-colors="availableColors"
      :multiple="true"
      :disabled="!canPerformActions || copyPropertiesToMode"
      btn-class="btn-xs"
      @update:selected-track-ids="onAudioTrackIdsChange"
    />

    <div class="tooltip tooltip-bottom">
      <div class="tooltip-content flex flex-col items-center gap-0.5">
        Copiar propiedades a otros versos<br />
        <KeybindingDisplay :key-parts="getKeybindingParts('copy-properties')" k />
      </div>
      <button
        class="btn btn-xs btn-square btn-ghost"
        :class="{ 'btn-active': copyPropertiesToMode }"
        :disabled="!canPerformActions"
        @click="() => executeCommand('copy-properties')"
      >
        <PaintRoller class="size-3" />
        <span class="sr-only">Copiar propiedades a otros versos</span>
      </button>
    </div>

    <!-- Timestamp visibility -->
    <div class="divider divider-horizontal mx-0"></div>

    <div class="tooltip tooltip-bottom">
      <div class="tooltip-content flex flex-col items-center gap-0.5">
        Mostrar/ocultar marcas de tiempo
      </div>
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
      <div class="tooltip-content flex flex-col items-center gap-0.5">
        Establecer tiempo de inicio<br />
        <KeybindingDisplay :key-parts="getKeybindingParts('set-start-time')" k />
      </div>
      <button
        class="btn btn-xs btn-square btn-ghost"
        :disabled="!canPerformActions"
        @click="() => executeCommand('set-start-time')"
      >
        <ArrowLeftToLine class="size-3" />
        <span class="sr-only">Establecer tiempo de inicio</span>
      </button>
    </div>

    <div class="tooltip tooltip-bottom">
      <div class="tooltip-content flex flex-col items-center gap-0.5">
        Establecer tiempo de finalización<br />
        <KeybindingDisplay :key-parts="getKeybindingParts('set-end-time')" k />
      </div>
      <button
        class="btn btn-xs btn-square btn-ghost"
        :disabled="!canPerformActions"
        @click="() => executeCommand('set-end-time')"
      >
        <ArrowRightToLine class="size-3" />
        <span class="sr-only">Establecer tiempo de finalización</span>
      </button>
    </div>

    <div class="tooltip tooltip-bottom">
      <div class="tooltip-content flex flex-col items-center gap-0.5">
        Limpiar tiempos<br />
        <KeybindingDisplay :key-parts="getKeybindingParts('clear-both-times')" kbd-class="kbd-sm" />
      </div>
      <button
        class="btn btn-xs btn-square btn-ghost"
        :disabled="!canPerformActions"
        @click="() => executeCommand('clear-both-times')"
      >
        <X class="size-3" />
        <span class="sr-only">Limpiar ambos tiempos</span>
      </button>
    </div>

    <!-- Stanza operations -->
    <div class="divider divider-horizontal mx-0"></div>

    <div class="tooltip tooltip-bottom">
      <div class="tooltip-content flex flex-col items-center gap-0.5">
        Agregar estrofa<br />
        <KeybindingDisplay :key-parts="getKeybindingParts('insert-stanza')" k />
      </div>
      <button
        class="btn btn-xs btn-square btn-ghost"
        :disabled="!canPerformActions"
        @click="() => executeCommand('insert-stanza')"
      >
        <ListPlus class="size-3" />
        <span class="sr-only">Agregar estrofa</span>
      </button>
    </div>

    <!-- Delete line -->
    <div class="divider divider-horizontal mx-0"></div>

    <div class="tooltip tooltip-bottom">
      <div class="tooltip-content flex flex-col items-center gap-0.5">
        Eliminar verso<br />
        <KeybindingDisplay :key-parts="getKeybindingParts('delete-line')" k />
      </div>
      <button
        class="btn btn-xs btn-square btn-ghost"
        :disabled="!canPerformActions"
        @click="() => executeCommand('delete-line')"
      >
        <Trash2 class="size-3" />
        <span class="sr-only">Eliminar verso</span>
      </button>
    </div>
  </div>
</template>
