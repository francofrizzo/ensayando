<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import ProgressSpinner from 'primevue/progressspinner'

import LyricsViewer from '@/components/LyricsViewer.vue'

import type { Song } from '@/data/song.types'
import type { Collection } from '@/data/collection.types'
import PlayerHeader from '@/components/PlayerHeader.vue'
import PlayerControls from '@/components/PlayerControls.vue'
import TrackPlayer from '@/components/TrackPlayer.vue'

// Props and Emits
const props = defineProps<{ 
  collection: Collection
  song: Song 
}>()

const emit = defineEmits<{
  'update:currentTime': [time: number]
  'update:playing': [isPlaying: boolean]
}>()
 

const state = {
  currentTime: ref<number>(0),
  lastSeekTime: ref<number>(0),
  totalDuration: ref<number>(0),
  playing: ref(false),
  trackStates: ref<{ isReady: boolean, volume: number }[]>(
    props.song.tracks.map(() => ({ isReady: false, volume: 1 }))
  )
}

// Computed
const isReady = computed(() => state.trackStates.value.every((track) => track.isReady))

const onReady = (trackIndex: number, duration: number) => {
  state.trackStates.value[trackIndex].isReady = true
  if (trackIndex === 0) {
    state.totalDuration.value = duration
  }
}

const onTimeUpdate = (trackIndex: number, time: number) => {
  if (trackIndex === 0) {
    state.currentTime.value = time
    emit('update:currentTime', time)
  }
}

const onVolumeChange = (trackIndex: number, volume: number) => {
  state.trackStates.value[trackIndex].volume = volume
}

const onToggleTrackMuted = (trackIndex: number) => {
  state.trackStates.value[trackIndex].volume = state.trackStates.value[trackIndex].volume === 0 ? 1 : 0
}

const onSoloTrack = (index: number) => {
  const isCurrentlySoloed = state.trackStates.value.every((track, i) => i === index || track.volume === 0)
  if (isCurrentlySoloed) {
    state.trackStates.value.forEach((_, i) => {
      onVolumeChange(i, 1)
    })
  } else {
    state.trackStates.value.forEach((_, i) => {
      onVolumeChange(i, i === index ? 1 : 0)
    })
  }
}

const onPlayPause = (forcePlay?: boolean) => {
  state.playing.value = forcePlay ?? !state.playing.value
  emit('update:playing', state.playing.value)
}

const onSeekToTime = (time: number) => {
  state.lastSeekTime.value = time
}

const keydownHandler = (event: KeyboardEvent) => {
  if (event.key === ' ') {
    event.preventDefault()
    onPlayPause()
  }
}

onMounted(() => {
  window.addEventListener('keydown', keydownHandler)
})

onUnmounted(() => {
  window.removeEventListener('keydown', keydownHandler)
})
</script>

<template>
  <div class="bg-surface-50 dark:bg-surface-950 flex w-full h-dvh flex-col p-2">
    <div class="pt-2 pb-3 px-2 flex items-center justify-between gap-3">
      <PlayerHeader :collection="collection" :song="song" />
      <PlayerControls
        :currentTime="state.currentTime.value"
        :totalDuration="state.totalDuration.value"
        :isPlaying="state.playing.value"
        :isReady="isReady"
        @play-pause="onPlayPause"
      />
    </div>

    <div class="h-full flex-grow-1 overflow-y-auto px-2 mb-3">
      <LyricsViewer
        :lyrics="song.lyrics"
        :currentTime="state.currentTime.value"
        :isDisabled="!isReady"
        @seek="onSeekToTime"
      />
    </div>

    <div
      class="relative border border-surface-200 dark:border-surface-800 rounded-lg bg-surface-100 dark:bg-surface-900 md:m-3"
    >
      <div class="h-full overflow-y-auto">
        <div class="w-full h-full py-3 pl-3 md:pl-4">
          <div class="flex flex-col gap-3" v-for="(track, index) in song.tracks" :key="index">
            <div class="flex items-center gap-2">
              <TrackPlayer
                :track="track"
                :index="index"
                :isReady="state.trackStates.value[index].isReady"
                :volume="state.trackStates.value[index].volume"
                :isPlaying="state.playing.value"
                :lastSeekTime="state.lastSeekTime.value"
                @ready="onReady"
                @time-update="onTimeUpdate"
                @volume-change="onVolumeChange"
                @seek-to-time="onSeekToTime"
                @solo-track="onSoloTrack"
                @toggle-track-muted="onToggleTrackMuted"
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
  </div>
</template>
