<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import type WaveSurfer from 'wavesurfer.js'
import { WaveSurferPlayer } from '@meersagor/wavesurfer-vue'
import ToggleSwitch from 'primevue/toggleswitch'
import { $dt } from '@primevue/themes'
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'

import LyricsViewer from '@/components/LyricsViewer.vue'

import { useSongsStore } from '@/stores/songs'
import type { Song } from '@/data/song.types'
import type { PartialWaveSurferOptions } from 'node_modules/@meersagor/wavesurfer-vue/dist/types/types'

// Utility functions
const getTrackColor = (index: number) => {
  const colors = ['emerald', 'amber', 'sky', 'rose', 'indigo', 'lime']
  return colors[index % colors.length]
}

const getWaveSurferColorScheme = (index: number, muted = false) => {
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches
  if (muted) {
    return {
      waveColor: isDarkMode ? $dt('gray.700').value : $dt('gray.300').value,
      progressColor: $dt('gray.500').value
    }
  } else {
    const color = getTrackColor(index)
    return {
      waveColor: isDarkMode ? $dt(`${color}.700`).value : $dt(`${color}.300`).value,
      progressColor: $dt(`${color}.500`).value
    }
  }
}

const getToggleColorScheme = (index: number) => {
  const color = getTrackColor(index)
  return {
    colorScheme: {
      light: {
        root: {
          checkedBackground: `{${color}.500}`,
          checkedHoverBackground: `{${color}.600}`
        }
      },
      dark: {
        root: {
          checkedBackground: `{${color}.400}`,
          checkedHoverBackground: `{${color}.300}`
        }
      }
    }
  }
}

// Component logic

const songsStore = useSongsStore()

const props = defineProps<{ song: Song }>()

const menu = ref()
const toggleMenu = (event: MouseEvent) => {
  menu.value.toggle(event)
}
const menuItems = songsStore.allSongs.map((song) => ({
  label: song.title,
  command: () => songsStore.changeSong(song.title)
}))

const waveSurferOptions = ref<PartialWaveSurferOptions>({
  height: 120,
  barGap: 5,
  barWidth: 4,
  barRadius: 8,
  dragToSeek: false
})

const currentTime = ref<number>(0)
const totalDuration = ref<number>(0)
const isPlaying = ref(false)
const trackData = ref<{ waveSurfer: WaveSurfer | null; isMuted: boolean }[]>(
  props.song.tracks.map(() => ({ waveSurfer: null, isMuted: false }))
)

const onReady = (duration: number) => {
  totalDuration.value = duration
}
const onTimeUpdate = (time: number) => {
  currentTime.value = time
}

const onToggleTrackMuted = (index: number) => {
  const isMuted = !trackData.value[index].isMuted
  trackData.value[index].isMuted = isMuted
  trackData.value[index].waveSurfer?.setMuted(isMuted)
  trackData.value[index].waveSurfer?.setOptions(getWaveSurferColorScheme(index, isMuted))
}

const onPlayPause = (forcePlay?: boolean) => {
  const shouldPlay = forcePlay !== undefined ? forcePlay : !isPlaying.value
  if (shouldPlay) {
    for (const track of trackData.value) {
      track.waveSurfer?.play()
    }
  } else {
    for (const track of trackData.value) {
      track.waveSurfer?.pause()
    }
  }
  isPlaying.value = shouldPlay
}

const onSeekToTime = (time: number) => {
  for (const track of trackData.value) {
    track.waveSurfer?.setTime(time)
  }
  onPlayPause(true)
}

const spaceKeyHandler = (event: KeyboardEvent) => {
  if (event.key === ' ') {
    event.preventDefault()
    onPlayPause()
  }
}

onMounted(() => {
  window.onkeydown = spaceKeyHandler
})

onUnmounted(() => {
  window.removeEventListener('keydown', spaceKeyHandler)
  for (const track of trackData.value) {
    track.waveSurfer?.destroy()
  }
})

const formatTime = (seconds: number): string =>
  [seconds / 60, seconds % 60].map((v) => `${Math.floor(v)}`.padStart(2, '0')).join(':')
</script>

<template>
  <div class="surface-100 flex w-full h-dvh flex-col p-2">
    <div class="pt-2 pb-3 px-2 flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <Menu ref="menu" id="overlay_menu" :popup="true" :model="menuItems" />
        <Button
          class="flex-shrink-0"
          type="button"
          icon="pi pi-bars"
          @click="toggleMenu"
          aria-haspopup="true"
          aria-controls="overlay_menu"
        />

        <span class="text-lg">{{ song.title }}</span>
      </div>

      <div class="flex items-center gap-3 text-right">
        <span class="text-surface-400"
          >{{ formatTime(currentTime)
          }}<span class="text-surface-500 text-sm">.{{ currentTime.toFixed(2).split('.')[1] }}</span
          >&nbsp;/ {{ formatTime(totalDuration)
          }}<span class="text-surface-500 text-sm"
            >.{{ totalDuration.toFixed(2).split('.')[1] }}</span
          ></span
        >
        <Button
          class="flex-shrink-0"
          :icon="isPlaying ? 'pi pi-pause' : 'pi pi-play'"
          @click="() => onPlayPause()"
          rounded
          aria-label="Play/Pause"
        />
      </div>
    </div>

    <Splitter
      layout="vertical"
      class="border border-green-500 flex-grow min-h-0 border border-green-500"
    >
      <SplitterPanel class="outline-none" :size="75">
        <div class="h-full overflow-y-auto">
          <div class="w-full py-3 pl-2 md:pl-4">
            <div v-for="(track, index) in song.tracks" class="flex items-center gap-3">
              <div
                class="w-14 md:w-24 min-w-0 flex flex-grow-0 flex-shrink-0 flex-col justify-center gap-2"
              >
                <span class="truncate">{{ track.title }}</span>
                <ToggleSwitch
                  @change="() => onToggleTrackMuted(index)"
                  :dt="getToggleColorScheme(index)"
                  :modelValue="!trackData[index]?.isMuted"
                />
              </div>
              <div class="w-full p-0">
                <WaveSurferPlayer
                  v-if="index === 0"
                  :options="{
                    ...waveSurferOptions,
                    ...getWaveSurferColorScheme(index),
                    url: track.file
                  }"
                  @interaction="(time: number) => onSeekToTime(time)"
                  @waveSurfer="(ws: WaveSurfer) => (trackData[index].waveSurfer = ws)"
                  @ready="(duration: number) => onReady(duration)"
                  @timeupdate="(time: number) => onTimeUpdate(time)"
                />
                <WaveSurferPlayer
                  v-else
                  :options="{
                    ...waveSurferOptions,
                    ...getWaveSurferColorScheme(index),
                    url: track.file
                  }"
                  @interaction="(time: number) => onSeekToTime(time)"
                  @waveSurfer="(ws: WaveSurfer) => (trackData[index].waveSurfer = ws)"
                />
              </div>
            </div>
          </div>
        </div>
      </SplitterPanel>
      <SplitterPanel class="outline-none" :size="25">
        <div class="h-full overflow-y-auto px-2">
          <LyricsViewer :lyrics="song.lyrics" :currentTime="currentTime" @seek="onSeekToTime" />
        </div>
      </SplitterPanel>
    </Splitter>
  </div>
</template>
