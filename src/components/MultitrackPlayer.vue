<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type WaveSurfer from 'wavesurfer.js'
import { WaveSurferPlayer } from '@meersagor/wavesurfer-vue'
import ToggleSwitch from 'primevue/toggleswitch'
import { $dt } from '@primevue/themes'
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import ProgressSpinner from 'primevue/progressspinner'

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
  const color = muted ? 'zinc' : getTrackColor(index)
  return {
    waveColor: isDarkMode ? $dt(`${color}.700`).value : $dt(`${color}.300`).value,
    progressColor: isDarkMode ? $dt(`${color}.500`).value : $dt(`${color}.400`).value
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
  dragToSeek: false,
  backend: 'WebAudio'
})

const currentTime = ref<number>(0)
const totalDuration = ref<number>(0)
const isPlaying = ref(false)
const trackData = ref<{ waveSurfer: WaveSurfer | null; isMuted: boolean; isReady: boolean }[]>(
  props.song.tracks.map(() => ({ waveSurfer: null, isMuted: false, isReady: false }))
)

const isReady = computed(() => trackData.value.every((track) => track.isReady))

const isCtrlPressed = ref(false)

const onReady = (index: number, duration: number) => {
  trackData.value[index].isReady = true
  if (index === 0) {
    totalDuration.value = duration
  }
}
const onTimeUpdate = (index: number, time: number) => {
  if (index === 0) {
    currentTime.value = time
  }
}

const onToggleTrackMuted = (index: number) => {
  const isMuted = !trackData.value[index].isMuted
  trackData.value[index].isMuted = isMuted
  trackData.value[index].waveSurfer?.setVolume(isMuted ? 0 : 1)
  trackData.value[index].waveSurfer?.setOptions(getWaveSurferColorScheme(index, isMuted))
}

const onChangeTrackMutedSwitch = (index: number) => {
  if (!isCtrlPressed.value) {
    onToggleTrackMuted(index)
  } else {
    for (let index2 = 0; index2 < trackData.value.length; index2++) {
      if (index !== index2) {
        onToggleTrackMuted(index2)
      }
    }
  }
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

const keydownHandler = (event: KeyboardEvent) => {
  if (event.key === ' ') {
    event.preventDefault()
    onPlayPause()
  } else if (
    navigator.userAgent.indexOf('Mac') > 0 ? event.key === 'Meta' : event.key === 'Control'
  ) {
    isCtrlPressed.value = true
  }
}

const keyupHandler = (event: KeyboardEvent) => {
  if (navigator.userAgent.indexOf('Mac') > 0 ? event.key === 'Meta' : event.key === 'Control') {
    isCtrlPressed.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', keydownHandler)
  window.addEventListener('keyup', keyupHandler)
})

onUnmounted(() => {
  window.removeEventListener('keydown', keydownHandler)
  window.removeEventListener('keyup', keyupHandler)
  for (const track of trackData.value) {
    track.waveSurfer?.destroy()
  }
})

const formatTime = (seconds: number): string =>
  [seconds / 60, seconds % 60].map((v) => `${Math.floor(v)}`.padStart(2, '0')).join(':')
</script>

<template>
  <div class="bg-surface-50 dark:bg-surface-950 flex w-full h-dvh flex-col p-2">
    <div class="pt-2 pb-3 px-2 flex items-center justify-between gap-3">
      <div class="flex items-center gap-4">
        <Menu ref="menu" id="overlay_menu" :popup="true" :model="menuItems" />
        <Button
          class="flex-shrink-0"
          type="button"
          icon="pi pi-bars"
          @click="toggleMenu"
          aria-haspopup="true"
          aria-controls="overlay_menu"
        />

        <span class="text-lg font-bold">{{ song.title }}</span>
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
          :disabled="!isReady"
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
        <div class="h-full relative">
          <div class="h-full overflow-y-auto">
            <div class="w-full h-full py-3 pl-3 md:pl-4">
              <div v-for="(track, index) in song.tracks" class="flex items-center gap-3">
                <div
                  class="w-14 md:w-24 min-w-0 flex flex-grow-0 flex-shrink-0 flex-col justify-center gap-2"
                >
                  <div class="flex flex-col gap-1">
                    <span class="text-ellipsis overflow-hidden">{{ track.title }}</span>
                    <span
                      v-if="track.subtitle"
                      class="text-ellipsis overflow-hidden text-surface-400 text-xs uppercase tracking-wider"
                      >{{ track.subtitle }}</span
                    >
                  </div>
                  <ToggleSwitch
                    @change="() => onChangeTrackMutedSwitch(index)"
                    :dt="getToggleColorScheme(index)"
                    :modelValue="!trackData[index]?.isMuted"
                  />
                </div>
                <div class="w-full p-0">
                  <WaveSurferPlayer
                    :options="{
                      ...waveSurferOptions,
                      ...getWaveSurferColorScheme(index),
                      url: track.file
                    }"
                    @interaction="(time: number) => onSeekToTime(time)"
                    @waveSurfer="(ws: WaveSurfer) => (trackData[index].waveSurfer = ws)"
                    @ready="(duration: number) => onReady(index, duration)"
                    @timeupdate="(time: number) => onTimeUpdate(index, time)"
                  />
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="!isReady"
            class="absolute top-0 left-0 bottom-0 right-0 z-10 bg-surface-200 dark:bg-surface-800 rounded opacity-80 flex flex-col gap-4 text-xl items-center justify-center"
          >
            <ProgressSpinner />
            Cargando...
          </div>
        </div>
      </SplitterPanel>
      <SplitterPanel class="outline-none" :size="25">
        <div class="h-full overflow-y-auto px-2">
          <LyricsViewer
            :lyrics="song.lyrics"
            :currentTime="currentTime"
            :isDisabled="!isReady"
            @seek="onSeekToTime"
          />
        </div>
      </SplitterPanel>
    </Splitter>
  </div>
</template>
