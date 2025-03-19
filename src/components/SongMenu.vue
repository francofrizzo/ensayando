<script setup lang="ts">
import type { Collection } from '@/data/collection.types'
import { useSongsStore } from '@/stores/songs'
import { Menu } from 'lucide-vue-next'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import { computed, ref } from 'vue'

const props = defineProps<{
  collection: Collection
}>()

const songsStore = useSongsStore()

const visible = ref(false)

const songMenuItems = computed(() => {
  return songsStore.songs
    .filter((song) => song.collectionId === props.collection.id)
    .map((song) => ({
      label: song.title,
      id: song.id
    }))
})

const otherCollectionMenuItems = computed(() => {
  return songsStore.collections
    .filter((collection) => collection.id !== props.collection.id && collection.enabled !== false)
    .map((collection) => ({
      label: collection.title,
      id: collection.id
    }))
})

const itemColorScheme = computed(() => {
  return {
    colorScheme: {
      light: {
        text: {
          primary: {
            color: `{${props.collection.theme.mainColor}.500}`,
            hoverBackground: `color-mix(in srgb, {${props.collection.theme.mainColor}.500}, transparent 90%)`,
            activeBackground: `color-mix(in srgb, {${props.collection.theme.mainColor}.500}, transparent 80%)`
          }
        }
      },
      dark: {
        text: {
          primary: {
            color: `{${props.collection.theme.mainColor}.500}`,
            hoverBackground: `color-mix(in srgb, {${props.collection.theme.mainColor}.500}, transparent 90%)`,
            activeBackground: `color-mix(in srgb, {${props.collection.theme.mainColor}.500}, transparent 80%)`
          }
        }
      }
    }
  }
})
</script>

<template>
  <div class="flex items-center gap-4">
    <Drawer v-model:visible="visible" :header="props.collection.title">
      <div class="flex flex-col gap-6 justify-between h-full">
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-2">
            <div class="flex flex-col gap-2">
              <Button
                v-for="song in songMenuItems"
                :key="song.label"
                @click="songsStore.changeSong(song.id)"
                :text="songsStore.currentSong?.id !== song.id"
                :dt="itemColorScheme"
                :label="song.label"
                :pt="{
                  label: { class: 'text-left w-full font-normal' }
                }"
              />
            </div>
          </div>
        </div>
        <div class="flex flex-col gap-2" v-if="otherCollectionMenuItems.length > 0">
          <span class="text-muted-color font-medium uppercase text-sm">Otras colecciones</span>
          <div class="flex flex-col gap-2">
            <Button
              v-for="collection in otherCollectionMenuItems"
              :key="collection.label"
              @click="songsStore.changeCollection(collection.id)"
              text
              :dt="itemColorScheme"
              :pt="{
                label: { class: 'text-left w-full font-normal' }
              }"
              :label="collection.label"
            />
          </div>
        </div>
      </div>
    </Drawer>

    <Button
      class="flex-shrink-0 aspect-square"
      type="button"
      @click="visible = true"
      aria-haspopup="true"
      aria-controls="overlay_menu"
    >
      <Menu class="w-5 h-5" />
    </Button>
  </div>
</template>
