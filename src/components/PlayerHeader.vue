<script setup lang="ts">
import SongMenu from '@/components/SongMenu.vue'
import type { Collection } from '@/data/collection.types'
import type { Song } from '@/data/song.types'

const props = defineProps<{
  collection: Collection
  song: Song
}>()
</script>

<template>
  <div class="flex items-center gap-4">
    <SongMenu :collection="collection" />

    <div class="flex flex-col tracking-wide">
      <span class="text-lg font-semibold">{{ song.title }}</span>
      <span class="text-xs font-medium uppercase text-muted-color">{{ collection.title }}</span>
    </div>
  </div>
</template>
