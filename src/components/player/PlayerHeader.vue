<script setup lang="ts">
import SongMenu from "@/components/navigation/SongMenu.vue";
import type { Collection, Song } from "@/data/types";

const props = defineProps<{
  collection: Collection;
  song: Song;
}>();

const emit = defineEmits<{
  (e: "toggle-edit"): void;
}>();
</script>

<template>
  <div class="flex items-center gap-3 sm:gap-4 min-w-0">
    <SongMenu :collection="props.collection" class="shrink-0" @toggle-edit="emit('toggle-edit')" />

    <div class="flex flex-col tracking-wide min-w-0 gap-1">
      <span class="text-lg font-semibold text-ellipsis line-clamp-2 leading-tight tracking-tight">{{
        props.song.title
      }}</span>
      <span class="text-xs font-medium uppercase text-base-content/50 text-ellipsis line-clamp-1">{{
        props.collection.title
      }}</span>
    </div>
  </div>
</template>
