import type { Song } from '@/data/song.types'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSongsStore = defineStore('songs', () => {
  const allSongs = ref<Song[]>([])
  let currentSong = ref<Song | undefined>(undefined)

  fetch('/bj/songs.json').then((res) =>
    res.json().then((data) => {
      allSongs.value = data
      currentSong.value = data[0]
    })
  )

  function changeCurrentSong(title: string) {
    const matchingSong = allSongs.value.find((song) => song.title === title)
    if (matchingSong) {
      currentSong.value = matchingSong
    }
  }

  return { allSongs, currentSong, changeSong: changeCurrentSong }
})
