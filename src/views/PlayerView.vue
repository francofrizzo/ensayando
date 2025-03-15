<script setup lang="ts">
import MultitrackPlayer from '@/components/MultitrackPlayer.vue'
import LoadingScreen from '@/components/LoadingScreen.vue'
import { useSongsStore } from '@/stores/songs'

const songsStore = useSongsStore()
</script>

<template>
  <MultitrackPlayer
    v-if="songsStore.currentCollection && songsStore.currentSong"
    :collection="songsStore.currentCollection"
    :song="songsStore.currentSong"
    :key="songsStore.currentSong.title"
  />
  <LoadingScreen v-else />
</template>
