<script setup lang="ts">
import { ref, computed } from 'vue'
import Menu from 'primevue/menu'
import Button from 'primevue/button'
import { useSongsStore } from '@/stores/songs'
import type { Collection } from '@/data/collection.types'

const props = defineProps<{
  collection: Collection
}>()

const songsStore = useSongsStore()
const menu = ref()

const toggleMenu = (event: MouseEvent) => {
  menu.value.toggle(event)
}

const menuItems = computed(() => {
  const currentCollectionSongs = songsStore.songs
    .filter((song) => song.collectionId === props.collection.id)
    .map((song) => ({
      label: song.title,
      command: () => songsStore.changeSong(song.title)
    }))

  const otherCollections = songsStore.collections
    .filter((c) => c.id !== props.collection.id)
    .map((collection) => ({
      label: collection.title,
      command: () => songsStore.changeCollection(collection)
    }))

  return [
    {
      label: props.collection.title,
      items: currentCollectionSongs
    },
    {
      label: 'Otras colecciones',
      items: otherCollections
    }
  ]
})
</script>

<template>
  <div class="flex items-center gap-4">
    <Menu ref="menu" id="overlay_menu" :popup="true" :model="menuItems">
      <template #submenulabel="{ item }">
        <span class="text-muted-color uppercase text-sm ">{{ item.label }}</span>
      </template>
    </Menu>
    <Button
      class="flex-shrink-0 aspect-square"
      type="button"
      icon="pi pi-bars"
      @click="toggleMenu"
      aria-haspopup="true"
      aria-controls="overlay_menu"
    />
  </div>
</template>
