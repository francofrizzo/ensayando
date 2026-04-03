<script setup lang="ts">
import KeybindingDisplay from "@/components/ui/KeybindingDisplay.vue";
import type { CommandRegistry } from "@/composables/useCommands";
import { X } from "lucide-vue-next";
import { computed, onMounted, onUnmounted } from "vue";

type Props = {
  show: boolean;
  commandRegistry: CommandRegistry;
};

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
}>();

// Handle Escape key to close modal
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape" && props.show) {
    emit("close");
  }
};

onMounted(() => {
  document.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleKeydown);
});

// Group commands with keybindings by category
const keybindingGroups = computed(() => {
  const commands = props.commandRegistry.getCommandsByCategory();

  const groups: Array<{
    category: string;
    items: Array<{
      description: string;
      keyParts: string[];
    }>;
  }> = [];

  Object.entries(commands).forEach(([category, categoryCommands]) => {
    const items = categoryCommands
      .filter((command) => command.keybinding)
      .map((command) => ({
        description: command.description,
        keyParts: props.commandRegistry.getKeybindingParts(command)
      }));

    if (items.length > 0) {
      groups.push({
        category,
        items
      });
    }
  });

  return groups;
});
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="emit('close')"></div>

      <div
        class="bg-base-100/75 border-base-300 relative mx-4 max-h-[70vh] w-full max-w-lg overflow-auto rounded-lg border shadow-xl"
      >
        <div
          class="bg-base-100/70 border-base-200 sticky top-0 z-10 flex items-center justify-between border-b px-5 py-3 backdrop-blur-lg"
        >
          <h2 class="text-base font-semibold">Atajos de teclado</h2>
          <button class="btn btn-xs btn-circle btn-ghost" @click="emit('close')">
            <X class="size-3.5" />
          </button>
        </div>

        <div class="space-y-4 px-5 py-4">
          <div v-for="group in keybindingGroups" :key="group.category">
            <h3 class="text-primary mb-2 text-xs font-medium tracking-wide uppercase">
              {{ group.category }}
            </h3>
            <div class="space-y-1">
              <div
                v-for="item in group.items"
                :key="item.description"
                class="flex items-center justify-between gap-4 py-0.5"
              >
                <span class="text-base-content/80 text-sm">{{ item.description }}</span>
                <KeybindingDisplay :key-parts="item.keyParts" kbd-class="kbd-xs" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-active {
  transition: all 200ms ease-out;
}
.modal-leave-active {
  transition: all 150ms ease-in;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
