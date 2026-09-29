<script setup lang="ts">
import { IconLibrary } from "@/components/ui/icons";
import { useUIStore } from "@/stores/ui";

// Opens the library (songs and collections). Replaces the old full-color menu button.
const uiStore = useUIStore();
</script>

<template>
  <button
    type="button"
    class="btn btn-circle btn-soft shrink-0"
    aria-label="Abrir biblioteca"
    :aria-expanded="uiStore.libraryOpen"
    @click="uiStore.openLibrary()"
  >
    <IconLibrary class="size-5" />
  </button>
</template>
