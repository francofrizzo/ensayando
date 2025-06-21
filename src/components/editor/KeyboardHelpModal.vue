<script setup lang="ts">
import { X } from "lucide-vue-next";
import { computed, onMounted, onUnmounted } from "vue";
import type { CommandRegistry } from "@/composables/useCommands";
import KeybindingDisplay from "@/components/ui/KeybindingDisplay.vue";

interface Props {
  show: boolean;
  commandRegistry: CommandRegistry;
}

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

  // Group by category
  const groups: Array<{
    category: string;
    items: Array<{
      description: string;
      keyParts: string[];
    }>;
  }> = [];

  Object.entries(commands).forEach(([category, categoryCommands]) => {
    const items = categoryCommands
      .filter((command) => command.keybinding) // Only include commands with keybindings
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
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="emit('close')"></div>

    <div
      class="relative bg-base-100/60 backdrop-blur-sm rounded-lg shadow-xl border border-base-300 max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto"
    >
      <div
        class="sticky top-0 bg-base-100 border-b border-base-200 px-6 py-4 flex items-center justify-between"
      >
        <h2 class="text-xl font-semibold">Atajos de teclado</h2>
        <button class="btn btn-sm btn-circle btn-ghost" @click="emit('close')">
          <X class="size-4" />
        </button>
      </div>

      <div class="p-6 space-y-6">
        <div v-for="group in keybindingGroups" :key="group.category">
          <h3 class="font-medium text-sm uppercase tracking-wide mb-3 text-primary">
            {{ group.category }}
          </h3>
          <div class="space-y-2">
            <div
              v-for="item in group.items"
              :key="item.description"
              class="flex justify-between items-center"
            >
              <span>{{ item.description }}</span>
              <KeybindingDisplay :key-parts="item.keyParts" size="sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
