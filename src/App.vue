<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { RouterView } from "vue-router";
import { Toaster } from "vue-sonner";
import "vue-sonner/style.css";

import CommandPalette from "@/components/navigation/CommandPalette.vue";
import LibraryPanel from "@/components/navigation/LibraryPanel.vue";
import { useTheme } from "@/composables/useTheme";
import { useUIStore } from "@/stores/ui";

const { resolvedTheme } = useTheme();
const uiStore = useUIStore();

// ⌘K / Ctrl+K opens search from anywhere, including text fields and the lyrics
// editor (it takes precedence over any screen-level binding of the same keys).
const onKeydown = (event: KeyboardEvent) => {
  if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
  if (event.key.toLowerCase() !== "k") return;
  event.preventDefault();
  event.stopPropagation();
  if (uiStore.commandPaletteOpen) uiStore.closeCommandPalette();
  else uiStore.openCommandPalette();
};

onMounted(() => window.addEventListener("keydown", onKeydown, true));
onUnmounted(() => window.removeEventListener("keydown", onKeydown, true));
</script>

<template>
  <RouterView v-slot="{ Component }">
    <Toaster :theme="resolvedTheme" rich-colors position="bottom-left" />
    <component :is="Component" />
  </RouterView>
  <LibraryPanel />
  <CommandPalette />
</template>
