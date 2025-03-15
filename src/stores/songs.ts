import type { Song } from '@/data/song.types'
import type { Collection } from '@/data/collection.types'
import { defineStore } from 'pinia'
import { ref } from 'vue'

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
