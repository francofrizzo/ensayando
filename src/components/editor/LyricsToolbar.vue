<script setup lang="ts">
import { computed } from "vue";

import {
  IconChevronDown,
  IconColumns,
  IconFollowPlayback,
  IconKeyboard,
  IconPlus,
  IconPreview,
  IconRedo,
  IconTimestamp,
  IconUndo
} from "@/components/ui/icons";
import type { CommandRegistry } from "@/composables/useCommands";
import type { FocusPosition } from "@/composables/useLyricsEditor";
import { prettyKeyParts } from "@/utils/keys";

const props = defineProps<{
  commandRegistry: CommandRegistry;
  currentFocus: FocusPosition | null;
  canUndo: boolean;
  canRedo: boolean;
  showTimestamps: boolean;
  followPlayback: boolean;
}>();

const emit = defineEmits<{
  "toggle-timestamps": [];
  "toggle-follow": [];
  preview: [];
  help: [];
}>();

const inColumns = computed(() => props.currentFocus?.columnIndex !== undefined);
const hasFocus = computed(() => props.currentFocus !== null);

type MenuItem = {
  id: string;
  label: string;
  /** Why the item can't run right now: shown instead of hiding the item. */
  reason?: string | null;
  danger?: boolean;
};

const insertItems = computed<MenuItem[]>(() => [
  { id: "insert-line", label: "Verso después" },
  { id: "insert-line-before", label: "Verso antes" },
  {
    id: "insert-line-outside-after",
    label: "Verso fuera de columnas",
    reason: inColumns.value ? null : "solo en columnas"
  },
  { id: "insert-stanza", label: "Estrofa nueva" },
  { id: "duplicate-line", label: "Duplicar verso" }
]);

const structureItems = computed<MenuItem[]>(() => [
  {
    id: "convert-to-columns",
    label: "Convertir en columnas",
    reason: inColumns.value ? "ya está en columnas" : null
  },
  {
    id: "insert-column-left",
    label: "Columna a la izquierda",
    reason: inColumns.value ? null : "solo en columnas"
  },
  {
    id: "insert-column-right",
    label: "Columna a la derecha",
    reason: inColumns.value ? null : "solo en columnas"
  },
  { id: "split-stanza", label: "Dividir estrofa acá" },
  { id: "join-stanzas", label: "Unir con la anterior" },
  { id: "move-line-up", label: "Mover verso arriba" },
  { id: "move-line-down", label: "Mover verso abajo" },
  { id: "delete-line", label: "Eliminar verso", danger: true }
]);

const menus = computed(() => [
  { id: "insert", label: "Insertar", icon: IconPlus, items: insertItems.value, width: "w-72" },
  {
    id: "structure",
    label: "Estructura",
    icon: IconColumns,
    items: structureItems.value,
    width: "w-80"
  }
]);

const keysFor = (commandId: string): string[] => {
  const command = props.commandRegistry.getCommand(commandId);
  return command ? prettyKeyParts(props.commandRegistry.getKeybindingParts(command)) : [];
};

const isDisabled = (item: MenuItem) => !hasFocus.value || !!item.reason;

const closeMenus = () => (document.activeElement as HTMLElement | null)?.blur?.();

const run = (commandId: string) => {
  props.commandRegistry.execute(commandId);
  // DaisyUI dropdowns stay open while something inside them has focus.
  closeMenus();
};
</script>

<template>
  <div
    class="border-base-content/8 flex flex-wrap items-center gap-1 border-b px-2.5 py-2 md:px-3"
    data-testid="lyrics-toolbar"
  >
    <div class="flex items-center">
      <button
        class="btn btn-ghost btn-sm btn-square rounded-full"
        :disabled="!canUndo"
        title="Deshacer (⌘Z)"
        @mousedown.prevent
        @click="run('undo')"
      >
        <IconUndo class="size-4" />
        <span class="sr-only">Deshacer</span>
      </button>
      <button
        class="btn btn-ghost btn-sm btn-square rounded-full"
        :disabled="!canRedo"
        title="Rehacer (⌘⇧Z)"
        @mousedown.prevent
        @click="run('redo')"
      >
        <IconRedo class="size-4" />
        <span class="sr-only">Rehacer</span>
      </button>
    </div>

    <span class="bg-base-content/10 mx-1 h-5 w-px" />

    <!-- mousedown.prevent keeps the verse's textarea focused, so commands still know where to act -->
    <div v-for="menu in menus" :key="menu.id" class="dropdown">
      <div
        tabindex="0"
        role="button"
        class="btn btn-ghost btn-sm gap-1.5 rounded-full font-semibold"
        :data-testid="`menu-${menu.id}`"
        @mousedown.prevent="($event.currentTarget as HTMLElement).focus()"
      >
        <component :is="menu.icon" class="size-4" />
        {{ menu.label }}
        <IconChevronDown class="size-3.5 opacity-60" />
      </div>
      <ul
        tabindex="0"
        class="dropdown-content menu glass-3 rounded-box z-40 mt-1.5 p-1.5"
        :class="menu.width"
      >
        <li v-for="item in menu.items" :key="item.id">
          <button
            class="flex items-center justify-between gap-3"
            :class="{ 'menu-disabled': isDisabled(item), 'text-error': item.danger }"
            :disabled="isDisabled(item)"
            :data-testid="`command-${item.id}`"
            @mousedown.prevent
            @click="run(item.id)"
          >
            <span>{{ item.label }}</span>
            <span v-if="item.reason" class="text-base-content/45 text-xs italic">
              {{ item.reason }}
            </span>
            <span v-else class="flex gap-0.5">
              <kbd v-for="k in keysFor(item.id)" :key="k" class="kbd kbd-xs">{{ k }}</kbd>
            </span>
          </button>
        </li>
      </ul>
    </div>

    <span class="bg-base-content/10 mx-1 hidden h-5 w-px sm:block" />

    <label
      class="btn btn-ghost btn-sm hidden gap-2 rounded-full font-semibold sm:inline-flex"
      title="Mostrar el tiempo de cada verso"
    >
      <input
        type="checkbox"
        class="toggle toggle-xs toggle-primary"
        :checked="showTimestamps"
        data-testid="toggle-times"
        @change="emit('toggle-timestamps')"
      />
      <IconTimestamp class="size-4 opacity-70" />
      Tiempos
    </label>

    <label
      class="btn btn-ghost btn-sm hidden gap-2 rounded-full font-semibold sm:inline-flex"
      title="Seguir reproducción: la hoja acompaña al verso que está sonando"
    >
      <input
        type="checkbox"
        class="toggle toggle-xs toggle-primary"
        :checked="followPlayback"
        data-testid="toggle-follow"
        @change="emit('toggle-follow')"
      />
      <IconFollowPlayback class="size-4 opacity-70" />
      Seguir
    </label>

    <button
      class="btn btn-ghost btn-sm gap-1.5 rounded-full font-semibold"
      title="Vista previa: el escenario con los cambios sin guardar (P)"
      data-testid="preview"
      @click="emit('preview')"
    >
      <IconPreview class="size-4" />
      <span class="hidden md:inline">Vista previa</span>
    </button>

    <div class="flex-1" />

    <button
      class="btn btn-ghost btn-sm gap-1.5 rounded-full font-semibold"
      title="Atajos de teclado (F1 o ?)"
      data-testid="shortcuts"
      @click="emit('help')"
    >
      <IconKeyboard class="size-4" />
      <span class="hidden md:inline">Atajos</span>
      <kbd class="kbd kbd-xs hidden md:inline-flex">F1</kbd>
    </button>
  </div>
</template>
