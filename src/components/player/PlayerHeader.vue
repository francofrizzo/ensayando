<script setup lang="ts">
import SongMenu from "@/components/navigation/SongMenu.vue";
import type { CollectionWithRole, Song } from "@/data/types";

const props = defineProps<{
  collection: CollectionWithRole;
  song: Song;
}>();

const emit = defineEmits<{
  (e: "toggle-edit"): void;
}>();
</script>

<template>
  <div class="flex min-w-0 items-center gap-3 sm:gap-4">
    <SongMenu :collection="props.collection" class="shrink-0" @toggle-edit="emit('toggle-edit')" />

    <div class="flex min-w-0 flex-col gap-1 tracking-wide">
      <span class="line-clamp-2 text-lg leading-tight font-semibold tracking-tight text-ellipsis">{{
        props.song.title
      }}</span>
      <span class="text-base-content/50 line-clamp-1 text-xs font-medium text-ellipsis uppercase">{{
        props.collection.title
      }}</span>
    </div>
  </div>
</template>
