<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";

import { IconClose, IconSearch } from "@/components/ui/icons";
import type { CommandRegistry } from "@/composables/useCommands";
import { prettyKeyParts } from "@/utils/keys";

type Props = {
  show: boolean;
  commandRegistry: CommandRegistry;
};

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
}>();

// The registry's categories, named by task and in the order people look for them.
const GROUPS: { category: string; title: string }[] = [
  { category: "Navegación", title: "Moverse" },
  { category: "Operaciones de versos", title: "Versos" },
  { category: "Operaciones de estrofas", title: "Estrofas" },
  { category: "Operaciones de columnas", title: "Columnas" },
  { category: "Marcas de tiempo", title: "Tiempos" },
  { category: "Acciones rápidas", title: "General" }
];

// Things the Letra tab does outside the command registry (mouse and view shortcuts).
const EXTRAS: Record<string, { description: string; keyParts: string[] }[]> = {
  "Operaciones de versos": [
    { description: "Ampliar la selección un verso", keyParts: ["⇧", "↑ ↓"] },
    { description: "Seleccionar hasta este verso", keyParts: ["⇧", "clic"] },
    { description: "Sumar o quitar un verso de la selección", keyParts: ["⌘", "clic"] }
  ],
  "Acciones rápidas": [
    { description: "Vista previa en el escenario", keyParts: ["P"] },
    { description: "Mostrar esta ayuda", keyParts: ["?"] },
    { description: "Buscar en toda la app", keyParts: ["⌘", "K"] }
  ]
};

const query = ref("");
const searchRef = ref<HTMLInputElement | null>(null);

const groups = computed(() => {
  const byCategory = props.commandRegistry.getCommandsByCategory();
  const needle = query.value.trim().toLowerCase();
  return GROUPS.map(({ category, title }) => {
    const items = [
      ...(byCategory[category] ?? [])
        .filter((command) => command.keybinding)
        // "Eliminar verso vacío" shares ⌫ with plain typing; it isn't something to look up
        .filter((command) => command.id !== "smart-backspace")
        .map((command) => ({
          description: command.description,
          keyParts: prettyKeyParts(props.commandRegistry.getKeybindingParts(command))
        })),
      ...(EXTRAS[category] ?? [])
    ].filter(
      (item) =>
        !needle ||
        item.description.toLowerCase().includes(needle) ||
        item.keyParts.join(" ").toLowerCase().includes(needle) ||
        title.toLowerCase().includes(needle)
    );
    return { title, items };
  }).filter((group) => group.items.length > 0);
});

watch(
  () => props.show,
  async (show) => {
    if (!show) return;
    query.value = "";
    await nextTick();
    searchRef.value?.focus();
  }
);

const handleKeydown = (event: KeyboardEvent) => {
  if (!props.show) return;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    emit("close");
  } else if (event.key === "/" && document.activeElement !== searchRef.value) {
    event.preventDefault();
    searchRef.value?.focus();
  }
};

onMounted(() => document.addEventListener("keydown", handleKeydown, true));
onUnmounted(() => document.removeEventListener("keydown", handleKeydown, true));
</script>

<template>
  <Transition name="modal">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      data-testid="shortcuts-sheet"
    >
      <div class="bg-base-300/40 fixed inset-0 backdrop-blur-[3px]" @click="emit('close')" />

      <div
        class="glass-3 rounded-box relative flex max-h-[80dvh] w-full max-w-2xl flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Atajos del editor de letra"
      >
        <div class="flex items-center gap-3 px-5 pt-4 pb-3">
          <h2 class="font-display flex-1 text-lg font-bold">Atajos del editor de letra</h2>
          <button
            class="btn btn-ghost btn-sm btn-square rounded-full"
            aria-label="Cerrar"
            @click="emit('close')"
          >
            <IconClose class="size-4" />
          </button>
        </div>

        <div class="px-5 pb-3">
          <label class="input input-sm flex w-full items-center gap-2 rounded-[10px] field-focus">
            <IconSearch class="size-4 opacity-50" />
            <input
              ref="searchRef"
              v-model="query"
              type="search"
              class="grow"
              placeholder="Buscar un comando o una tecla"
              data-testid="shortcuts-search"
              @keydown.stop="(e: KeyboardEvent) => e.key === 'Escape' && emit('close')"
            />
            <kbd class="kbd kbd-xs">/</kbd>
          </label>
        </div>

        <div class="grid min-h-0 gap-x-8 gap-y-5 overflow-y-auto px-5 pb-5 sm:grid-cols-2">
          <section v-for="group in groups" :key="group.title" class="flex flex-col gap-1">
            <h3
              class="text-base-content/50 mb-1 text-[11px] font-semibold tracking-[0.1em] uppercase"
            >
              {{ group.title }}
            </h3>
            <div
              v-for="item in group.items"
              :key="item.description"
              class="border-base-content/6 flex items-center justify-between gap-4 border-b py-1.5 last:border-b-0"
            >
              <span class="text-base-content/85 text-[13.5px]">{{ item.description }}</span>
              <span class="flex shrink-0 gap-0.5">
                <kbd v-for="(part, i) in item.keyParts" :key="i" class="kbd kbd-xs">{{ part }}</kbd>
              </span>
            </div>
          </section>
          <p v-if="groups.length === 0" class="text-base-content/50 py-6 text-center text-sm">
            Ningún atajo coincide con “{{ query }}”.
          </p>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-active {
  transition: opacity 200ms ease-out;
}
.modal-leave-active {
  transition: opacity 150ms ease-in;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
