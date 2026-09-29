<script setup lang="ts">
import {
  IconDownload,
  IconEdit,
  IconKeyboard,
  IconMore,
  IconSettings,
  IconThemeDark,
  IconThemeLight,
  IconThemeSystem
} from "@/components/ui/icons";
import { type ThemeMode, useTheme } from "@/composables/useTheme";

const props = defineProps<{
  canEdit: boolean;
  isAdmin: boolean;
  exporting: boolean;
  canDownload: boolean;
}>();

const emit = defineEmits<{
  download: [];
  edit: [];
  shortcuts: [];
  settings: [];
}>();

const { mode, setMode } = useTheme();

const THEMES: { value: ThemeMode; label: string; icon: typeof IconThemeSystem }[] = [
  { value: "system", label: "Sistema", icon: IconThemeSystem },
  { value: "light", label: "Claro", icon: IconThemeLight },
  { value: "dark", label: "Oscuro", icon: IconThemeDark }
];

// DaisyUI dropdowns close on blur.
const run = (action: () => void) => {
  (document.activeElement as HTMLElement | null)?.blur();
  action();
};
</script>

<template>
  <div class="dropdown dropdown-end">
    <div
      tabindex="0"
      role="button"
      class="btn btn-sm btn-circle btn-ghost"
      aria-label="Menú de la canción"
    >
      <IconMore class="size-[18px]" />
    </div>
    <ul tabindex="0" class="dropdown-content menu glass-3 rounded-box z-50 mt-2 w-72 gap-0.5 p-1.5">
      <li :class="{ 'menu-disabled': !props.canDownload || props.exporting }">
        <button @click="run(() => emit('download'))">
          <IconDownload class="size-[17px] opacity-70" />
          {{ props.exporting ? "Preparando la mezcla…" : "Descargar mezcla" }}
          <span class="ml-auto flex gap-0.5"><kbd class="kbd kbd-xs">⌘</kbd><kbd class="kbd kbd-xs">⇧</kbd><kbd class="kbd kbd-xs">E</kbd></span>
        </button>
      </li>
      <li v-if="props.canEdit">
        <button @click="run(() => emit('edit'))">
          <IconEdit class="size-[17px] opacity-70" />
          Editar canción
          <kbd class="kbd kbd-xs ml-auto">E</kbd>
        </button>
      </li>
      <li>
        <button @click="run(() => emit('shortcuts'))">
          <IconKeyboard class="size-[17px] opacity-70" />
          Atajos de teclado
          <kbd class="kbd kbd-xs ml-auto">?</kbd>
        </button>
      </li>
      <div class="bg-base-content/10 mx-1 my-1 h-px" />
      <li class="menu-title text-[11px] tracking-[0.1em] uppercase">Tema</li>
      <div class="px-1.5 pb-1.5">
        <div class="bg-base-content/7 flex gap-0.5 rounded-full p-[3px]" role="group" aria-label="Tema">
          <button
            v-for="theme in THEMES"
            :key="theme.value"
            class="flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-[13px] font-semibold transition-colors"
            :class="
              mode === theme.value
                ? 'bg-base-100 text-base-content shadow-sm'
                : 'text-base-content/60 hover:text-base-content'
            "
            :aria-pressed="mode === theme.value"
            @click="setMode(theme.value)"
          >
            <component :is="theme.icon" class="size-[15px]" />
            {{ theme.label }}
          </button>
        </div>
      </div>
      <template v-if="props.isAdmin">
        <div class="bg-base-content/10 mx-1 my-1 h-px" />
        <li>
          <button @click="run(() => emit('settings'))">
            <IconSettings class="size-[17px] opacity-70" />
            Ajustes de la colección
          </button>
        </li>
      </template>
    </ul>
  </div>
</template>
