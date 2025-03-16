import type { Song } from '@/data/song.types'
import type { Collection } from '@/data/collection.types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { updatePrimaryPalette } from '@primevue/themes'

export const useSongsStore = defineStore('songs', () => {
  const collections = ref<Collection[]>([])
  const songs = ref<Song[]>([])

  const currentCollection = ref<Collection | undefined>(undefined)
  const currentSong = ref<Song | undefined>(undefined)

  // Load collections on store initialization
  fetch('/bj/collections.json').then((res) =>
    res.json().then((data) => {
      collections.value = data
      changeCurrentCollection(data[1])
    })
  )

  async function changeCurrentCollection(collection: Collection) {
    currentCollection.value = collection
    // Reset songs and current song before loading new ones
    songs.value = []
    currentSong.value = undefined

    // Load songs for the selected collection
    const response = await fetch(`/bj/${collection.songsFile}`)
    const data = await response.json()
    songs.value = data.map((song: any) => ({
      ...song,
      collectionId: collection.id
    }))
    if (data.length > 0) {
      currentSong.value = songs.value[0]
    }

    const color = collection.theme.mainColor
    updatePrimaryPalette({
      50: `{${color}.50}`,
      100: `{${color}.100}`,
      200: `{${color}.200}`,
      300: `{${color}.300}`,
      400: `{${color}.400}`,
      500: `{${color}.500}`,
      600: `{${color}.600}`,
      700: `{${color}.700}`,
      800: `{${color}.800}`,
      900: `{${color}.900}`,
      950: `{${color}.950}`
    })
  }

  function changeCurrentSong(title: string) {
    const matchingSong = songs.value.find((song) => song.title === title)
    if (matchingSong) {
      currentSong.value = matchingSong
    }
  }

  return {
    collections,
    songs,
    currentCollection,
    currentSong,
    changeSong: changeCurrentSong,
    changeCollection: changeCurrentCollection
  }
})
