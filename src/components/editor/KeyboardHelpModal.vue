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
      class="bg-base-100/60 border-base-300 relative mx-4 max-h-[80vh] w-full max-w-2xl overflow-auto rounded-lg border shadow-xl backdrop-blur-sm"
    >
      <div
        class="bg-base-100 border-base-200 sticky top-0 flex items-center justify-between border-b px-6 py-4"
      >
        <h2 class="text-xl font-semibold">Atajos de teclado</h2>
        <button class="btn btn-sm btn-circle btn-ghost" @click="emit('close')">
          <X class="size-4" />
        </button>
      </div>

      <div class="space-y-6 p-6">
        <div v-for="group in keybindingGroups" :key="group.category">
          <h3 class="text-primary mb-3 text-sm font-medium tracking-wide uppercase">
            {{ group.category }}
          </h3>
          <div class="space-y-2">
            <div
              v-for="item in group.items"
              :key="item.description"
              class="flex items-center justify-between"
            >
              <span>{{ item.description }}</span>
              <KeybindingDisplay :key-parts="item.keyParts" kbd-class="kbd-sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
