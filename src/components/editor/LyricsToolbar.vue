<script setup lang="ts">
import {
  IconInsertAfter,
  IconInsertLeft,
  IconInsertRight,
  IconInsertBefore,
  IconTimestamp,
  IconColumns,
  IconCopy,
  IconAddStanza,
  IconJoinStanza,
  IconComment,
  IconCopyProperties,
  IconRedo,
  IconSplitStanza,
  IconTrash,
  IconUndo,
  IconClose
} from "@/components/ui/icons";
import { computed } from "vue";

import ColorPicker from "@/components/editor/ColorPicker.vue";
import { useCollectionsStore } from "@/stores/collections";
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
  // Comment
  currentVerseComment: string | undefined;
  onCommentChange: (comment: string | undefined) => void;
  // Timestamp offset
  timestampOffset: number;
};

const props = defineProps<Props>();

const emit = defineEmits<{
  "update:timestampOffset": [value: number];
}>();

const collectionsStore = useCollectionsStore();

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
    class="bg-base-100/50 border-base-content/10 rounded-box flex flex-wrap items-center justify-center gap-1.5 border p-1.5 shadow-lg backdrop-blur-sm"
  >
    <!-- Undo/Redo -->
    <div
      class="bg-base-content/5 flex items-center gap-0.5 rounded-[calc(var(--radius-box)-0.375rem)] px-1 py-0.5"
    >
      <div class="tooltip tooltip-bottom flex">
        <div class="tooltip-content flex flex-col items-center gap-0.5 text-[11px]">
          Deshacer<br />
          <KeybindingDisplay :key-parts="getKeybindingParts('undo')" kbd-class="kbd-xs" />
        </div>
        <button
          class="btn btn-xs btn-square btn-ghost"
          :disabled="!collectionsStore.canUndo"
          @click="() => executeCommand('undo')"
        >
          <IconUndo class="size-3" />
          <span class="sr-only">Deshacer</span>
        </button>
      </div>
      <div class="tooltip tooltip-bottom flex">
        <div class="tooltip-content flex flex-col items-center gap-0.5 text-[11px]">
          Rehacer<br />
          <KeybindingDisplay :key-parts="getKeybindingParts('redo')" kbd-class="kbd-xs" />
        </div>
        <button
          class="btn btn-xs btn-square btn-ghost"
          :disabled="!collectionsStore.canRedo"
          @click="() => executeCommand('redo')"
        >
          <IconRedo class="size-3" />
          <span class="sr-only">Rehacer</span>
        </button>
      </div>
    </div>

    <!-- Line operations -->
    <div
      class="bg-base-content/5 flex items-center gap-0.5 rounded-[calc(var(--radius-box)-0.375rem)] px-1 py-0.5"
    >
      <div class="tooltip tooltip-bottom flex">
        <div class="tooltip-content flex flex-col items-center gap-0.5 text-[11px]">
          Agregar verso después<br />
          <KeybindingDisplay :key-parts="getKeybindingParts('insert-line')" kbd-class="kbd-xs" />
        </div>
        <button
          class="btn btn-xs btn-square btn-ghost"
          :disabled="!canPerformActions"
          @click="() => executeCommand('insert-line')"
        >
          <IconInsertAfter class="size-3" />
          <span class="sr-only">Agregar verso después</span>
        </button>
      </div>

      <div class="tooltip tooltip-bottom flex">
        <div class="tooltip-content flex flex-col items-center gap-0.5 text-[11px]">
          Agregar verso antes<br />
          <KeybindingDisplay
            :key-parts="getKeybindingParts('insert-line-before')"
            kbd-class="kbd-xs"
          />
        </div>
        <button
          class="btn btn-xs btn-square btn-ghost"
          :disabled="!canPerformActions"
          @click="() => executeCommand('insert-line-before')"
        >
          <IconInsertBefore class="size-3" />
          <span class="sr-only">Agregar verso antes</span>
        </button>
      </div>

      <div class="tooltip tooltip-bottom flex">
        <div class="tooltip-content flex flex-col items-center gap-0.5 text-[11px]">
          Duplicar verso<br />
          <KeybindingDisplay :key-parts="getKeybindingParts('duplicate-line')" kbd-class="kbd-xs" />
        </div>
        <button
          class="btn btn-xs btn-square btn-ghost"
          :disabled="!canPerformActions"
          @click="() => executeCommand('duplicate-line')"
        >
          <IconCopy class="size-3" />
          <span class="sr-only">Duplicar verso</span>
        </button>
      </div>
    </div>

    <!-- Column operations -->
    <div
      class="bg-base-content/5 flex items-center gap-0.5 rounded-[calc(var(--radius-box)-0.375rem)] px-1 py-0.5"
    >
      <div v-if="!hasColumnContext" class="tooltip tooltip-bottom flex">
        <div class="tooltip-content flex flex-col items-center gap-0.5 text-[11px]">
          Convertir a columnas<br />
          <KeybindingDisplay
            :key-parts="getKeybindingParts('convert-to-columns')"
            kbd-class="kbd-xs"
          />
        </div>
        <button
          class="btn btn-xs btn-square btn-ghost"
          :disabled="!canPerformActions"
          @click="() => executeCommand('convert-to-columns')"
        >
          <IconColumns class="size-3" />
          <span class="sr-only">Convertir a columnas</span>
        </button>
      </div>

      <div v-if="hasColumnContext" class="tooltip tooltip-bottom flex">
        <div class="tooltip-content flex flex-col items-center gap-0.5 text-[11px]">
          Insertar columna a la izquierda<br />
          <KeybindingDisplay
            :key-parts="getKeybindingParts('insert-column-left')"
            kbd-class="kbd-xs"
          />
        </div>
        <button
          class="btn btn-xs btn-square btn-ghost"
          :disabled="!canPerformActions"
          @click="() => executeCommand('insert-column-left')"
        >
          <IconInsertLeft class="size-3" />
          <span class="sr-only">Insertar columna a la izquierda</span>
        </button>
      </div>

      <div v-if="hasColumnContext" class="tooltip tooltip-bottom flex">
        <div class="tooltip-content flex flex-col items-center gap-0.5 text-[11px]">
          Insertar columna a la derecha<br />
          <KeybindingDisplay
            :key-parts="getKeybindingParts('insert-column-right')"
            kbd-class="kbd-xs"
          />
        </div>
        <button
          class="btn btn-xs btn-square btn-ghost"
          :disabled="!canPerformActions"
          @click="() => executeCommand('insert-column-right')"
        >
          <IconInsertRight class="size-3" />
          <span class="sr-only">Insertar columna a la derecha</span>
        </button>
      </div>
    </div>

    <!-- Color and audio track operations -->
    <div
      class="bg-base-content/5 flex items-center gap-0.5 rounded-[calc(var(--radius-box)-0.375rem)] px-1 py-0.5"
    >
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

      <div class="tooltip tooltip-bottom flex">
        <div class="tooltip-content flex flex-col items-center gap-0.5 text-[11px]">
          Copiar propiedades a otros versos<br />
          <KeybindingDisplay
            :key-parts="getKeybindingParts('copy-properties')"
            kbd-class="kbd-xs"
          />
        </div>
        <button
          class="btn btn-xs btn-square btn-ghost"
          :class="{ 'btn-active': copyPropertiesToMode }"
          :disabled="!canPerformActions"
          @click="() => executeCommand('copy-properties')"
        >
          <IconCopyProperties class="size-3" />
          <span class="sr-only">Copiar propiedades a otros versos</span>
        </button>
      </div>

      <div class="tooltip tooltip-bottom flex">
        <div class="tooltip-content text-[11px]">Agregar/quitar comentario al verso</div>
        <button
          class="btn btn-xs btn-square btn-ghost"
          :class="{ 'btn-active': props.currentVerseComment !== '' }"
          :disabled="!canPerformActions || copyPropertiesToMode"
          @click="
            props.currentVerseComment !== undefined
              ? props.onCommentChange(undefined)
              : props.onCommentChange('')
          "
        >
          <IconComment class="size-3" />
          <span class="sr-only">Comentario del verso</span>
        </button>
      </div>
    </div>

    <!-- Timestamp section -->
    <div
      class="flex items-center gap-0.5 rounded-[calc(var(--radius-box)-0.375rem)] px-1 py-0.5"
      :class="showTimestamps ? 'bg-primary/10' : 'bg-base-content/5'"
    >
      <div class="tooltip tooltip-bottom flex">
        <div class="tooltip-content flex flex-col items-center gap-0.5 text-[11px]">
          Mostrar/ocultar marcas de tiempo
        </div>
        <button
          class="btn btn-xs btn-square"
          :class="{
            'btn-ghost': !showTimestamps,
            'btn-primary': showTimestamps
          }"
          @click="onToggleTimestamps"
        >
          <IconTimestamp class="size-3" />
          <span class="sr-only">Mostrar/ocultar marcas de tiempo</span>
        </button>
      </div>

      <div class="dropdown">
        <div
          tabindex="0"
          role="button"
          class="btn btn-xs btn-ghost gap-0 px-1.5 font-mono"
          title="Corrección por tiempo de reacción"
        >
          <span class="text-base-content/40 text-[10px]"
            >−{{ props.timestampOffset.toFixed(2) }}s</span
          >
        </div>
        <div
          tabindex="0"
          class="dropdown-content bg-base-100 rounded-box border-base-content/10 z-50 border p-3 shadow-xl"
        >
          <div class="flex flex-col gap-2">
            <span class="text-base-content/50 text-[10px] font-medium tracking-wider uppercase"
              >Corrección por reacción</span
            >
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              :value="props.timestampOffset"
              class="range range-xs range-primary w-32"
              @input="
                (e) => {
                  const v = parseFloat((e.target as HTMLInputElement).value);
                  if (!isNaN(v)) emit('update:timestampOffset', v);
                }
              "
            />
            <span class="text-base-content/50 text-center font-mono text-xs"
              >{{ props.timestampOffset.toFixed(2) }}s</span
            >
          </div>
        </div>
      </div>

      <div class="tooltip tooltip-bottom flex">
        <div class="tooltip-content flex flex-col items-center gap-0.5 text-[11px]">
          Establecer tiempo de inicio<br />
          <KeybindingDisplay :key-parts="getKeybindingParts('set-start-time')" kbd-class="kbd-xs" />
        </div>
        <button
          class="btn btn-xs btn-square btn-ghost"
          :disabled="!canPerformActions"
          @click="() => executeCommand('set-start-time')"
        >
          <IconInsertLeft class="size-3" />
          <span class="sr-only">Establecer tiempo de inicio</span>
        </button>
      </div>

      <div class="tooltip tooltip-bottom flex">
        <div class="tooltip-content flex flex-col items-center gap-0.5 text-[11px]">
          Establecer tiempo de finalización<br />
          <KeybindingDisplay :key-parts="getKeybindingParts('set-end-time')" kbd-class="kbd-xs" />
        </div>
        <button
          class="btn btn-xs btn-square btn-ghost"
          :disabled="!canPerformActions"
          @click="() => executeCommand('set-end-time')"
        >
          <IconInsertRight class="size-3" />
          <span class="sr-only">Establecer tiempo de finalización</span>
        </button>
      </div>

      <div class="tooltip tooltip-bottom flex">
        <div class="tooltip-content flex flex-col items-center gap-0.5 text-[11px]">
          Limpiar tiempos<br />
          <KeybindingDisplay
            :key-parts="getKeybindingParts('clear-both-times')"
            kbd-class="kbd-xs"
          />
        </div>
        <button
          class="btn btn-xs btn-square btn-ghost"
          :disabled="!canPerformActions"
          @click="() => executeCommand('clear-both-times')"
        >
          <IconClose class="size-3" />
          <span class="sr-only">Limpiar ambos tiempos</span>
        </button>
      </div>
    </div>

    <!-- Stanza + Delete -->
    <div
      class="bg-base-content/5 flex items-center gap-0.5 rounded-[calc(var(--radius-box)-0.375rem)] px-1 py-0.5"
    >
      <div class="tooltip tooltip-bottom flex">
        <div class="tooltip-content flex flex-col items-center gap-0.5 text-[11px]">
          Agregar estrofa<br />
          <KeybindingDisplay :key-parts="getKeybindingParts('insert-stanza')" kbd-class="kbd-xs" />
        </div>
        <button
          class="btn btn-xs btn-square btn-ghost"
          :disabled="!canPerformActions"
          @click="() => executeCommand('insert-stanza')"
        >
          <IconAddStanza class="size-3" />
          <span class="sr-only">Agregar estrofa</span>
        </button>
      </div>

      <div class="tooltip tooltip-bottom flex">
        <div class="tooltip-content flex flex-col items-center gap-0.5 text-[11px]">
          Dividir estrofa<br />
          <KeybindingDisplay :key-parts="getKeybindingParts('split-stanza')" kbd-class="kbd-xs" />
        </div>
        <button
          class="btn btn-xs btn-square btn-ghost"
          :disabled="!canPerformActions || currentFocus?.itemIndex === 0"
          @click="() => executeCommand('split-stanza')"
        >
          <IconSplitStanza class="size-3" />
          <span class="sr-only">Dividir estrofa</span>
        </button>
      </div>

      <div class="tooltip tooltip-bottom flex">
        <div class="tooltip-content flex flex-col items-center gap-0.5 text-[11px]">
          Unir con estrofa anterior
        </div>
        <button
          class="btn btn-xs btn-square btn-ghost"
          :disabled="!canPerformActions || (currentFocus?.stanzaIndex ?? 0) === 0"
          @click="() => executeCommand('join-stanzas')"
        >
          <IconJoinStanza class="size-3" />
          <span class="sr-only">Unir estrofas</span>
        </button>
      </div>

      <div class="tooltip tooltip-bottom flex">
        <div class="tooltip-content flex flex-col items-center gap-0.5 text-[11px]">
          Eliminar verso<br />
          <KeybindingDisplay :key-parts="getKeybindingParts('delete-line')" kbd-class="kbd-xs" />
        </div>
        <button
          class="btn btn-xs btn-square btn-ghost hover:text-error"
          :disabled="!canPerformActions"
          @click="() => executeCommand('delete-line')"
        >
          <IconTrash class="size-3" />
          <span class="sr-only">Eliminar verso</span>
        </button>
      </div>
    </div>
  </div>
</template>
