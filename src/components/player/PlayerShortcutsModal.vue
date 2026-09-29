<script setup lang="ts">
import { IconClose } from "@/components/ui/icons";

const props = defineProps<{ show: boolean; canEdit: boolean }>();
const emit = defineEmits<{ close: [] }>();

const SHORTCUTS: { label: string; keys: string[][]; editOnly?: boolean }[] = [
  { label: "Reproducir o pausar", keys: [["Espacio"]] },
  { label: "Retroceder o avanzar 0,1 s", keys: [["←"], ["→"]] },
  { label: "Retroceder o avanzar 3 s", keys: [["⇧", "←"], ["⇧", "→"]] },
  { label: "Estrofa anterior o siguiente", keys: [["↑"], ["↓"]] },
  { label: "Canción anterior o siguiente", keys: [["⇧", "↑"], ["⇧", "↓"]] },
  { label: "Silenciar la pista 1 a 9", keys: [["1"], ["…"], ["9"]] },
  { label: "Solo de la pista 1 a 9", keys: [["⌥", "1"], ["…"], ["⌥", "9"]] },
  { label: "Buscar canción o acción", keys: [["⌘", "K"]] },
  { label: "Editar canción", keys: [["E"]], editOnly: true },
  { label: "Descargar mezcla", keys: [["⌘", "⇧", "E"]] },
  { label: "Esta ayuda", keys: [["?"]] }
];
</script>

<template>
  <Teleport to="body">
    <Transition name="page-fade">
      <div
        v-if="props.show"
        class="fixed inset-0 z-[60] grid place-items-center bg-black/25 p-4"
        @click.self="emit('close')"
        @keydown.esc="emit('close')"
      >
        <div
          class="glass-3 rounded-box flex max-h-[85dvh] w-full max-w-md flex-col gap-3 overflow-y-auto p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="player-shortcuts-title"
        >
          <div class="flex items-center justify-between">
            <h2 id="player-shortcuts-title" class="font-display text-xl font-bold">
              Atajos de teclado
            </h2>
            <button class="btn btn-sm btn-circle btn-ghost" aria-label="Cerrar" @click="emit('close')">
              <IconClose class="size-4" />
            </button>
          </div>
          <ul class="flex flex-col">
            <li
              v-for="shortcut in SHORTCUTS.filter((s) => !s.editOnly || props.canEdit)"
              :key="shortcut.label"
              class="border-base-content/10 flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0"
            >
              <span>{{ shortcut.label }}</span>
              <span class="flex shrink-0 items-center gap-1.5">
                <span v-for="(combo, i) in shortcut.keys" :key="i" class="flex gap-0.5">
                  <kbd v-for="key in combo" :key="key" class="kbd kbd-sm">{{ key }}</kbd>
                </span>
              </span>
            </li>
          </ul>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
