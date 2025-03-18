<script setup lang="ts">
import LoadingScreen from '@/components/LoadingScreen.vue'
import MultitrackPlayer from '@/components/MultitrackPlayer.vue'
import { useSongsStore } from '@/stores/songs'
import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const props = defineProps<{
  collectionId?: string
  songId?: string
}>()

const route = useRoute()
const router = useRouter()
const songsStore = useSongsStore()

// Load collection and song based on route parameters
onMounted(async () => {
  // Initialize collections
  await songsStore.initializeCollections()

  // If we have route parameters, use them
  if (props.collectionId) {
    await songsStore.changeCollection(props.collectionId)

    if (props.songId) {
      const song = songsStore.getSongById(props.songId)
      if (song) {
        songsStore.changeSong(song.id)
      }
    } else if (songsStore.songs.length > 0) {
      // If no song specified but we have songs, select the first one
      songsStore.changeSong(songsStore.songs[0].id)
      router.push({
        name: 'song',
        params: {
          collectionId: props.collectionId,
          songId: songsStore.songs[0].id
        }
      })
    }
  } else if (songsStore.collections.length > 0) {
    // If no collection specified, select the first available one
    const defaultCollection =
      songsStore.collections.find((c) => c.enabled !== false) || songsStore.collections[0]
    if (defaultCollection) {
      await songsStore.changeCollection(defaultCollection.id)
      if (songsStore.songs.length > 0) {
        songsStore.changeSong(songsStore.songs[0].id)
        router.push({
          name: 'song',
          params: {
            collectionId: defaultCollection.id,
            songId: songsStore.songs[0].id
          }
        })
      }
    }
  }
})

// Update the route when collection or song changes
watch(
  () => songsStore.currentCollection,
  (collection) => {
    if (collection && route.params.collectionId !== collection.id) {
      if (songsStore.currentSong) {
        router.push({
          name: 'song',
          params: {
            collectionId: collection.id,
            songId: songsStore.currentSong.id
          }
        })
      } else {
        router.push({ name: 'collection', params: { collectionId: collection.id } })
      }
    }
  }
)

watch(
  () => songsStore.currentSong,
  (song) => {
    if (song && songsStore.currentCollection) {
      router.push({
        name: 'song',
        params: {
          collectionId: songsStore.currentCollection.id,
          songId: song.id
        }
      })
    }
  }
)
</script>

<template>
  <MultitrackPlayer
    v-if="songsStore.currentCollection && songsStore.currentSong"
    :collection="songsStore.currentCollection"
    :song="songsStore.currentSong"
    :key="songsStore.currentSong.id"
  />
  <LoadingScreen v-else />
</template>
