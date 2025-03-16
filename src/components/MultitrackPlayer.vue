<script setup lang="ts">
import ProgressSpinner from 'primevue/progressspinner'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import LyricsViewer from '@/components/LyricsViewer.vue'
import PlayerControls from '@/components/PlayerControls.vue'
import PlayerHeader from '@/components/PlayerHeader.vue'
import TimeCopier from '@/components/TimeCopier.vue'
import TrackPlayer from '@/components/TrackPlayer.vue'
import type { Collection } from '@/data/collection.types'
import type { Song } from '@/data/song.types'

// Props and Emits
const props = defineProps<{
  collection: Collection
  song: Song
}>()

const emit = defineEmits<{
  'update:currentTime': [time: number]
  'update:playing': [isPlaying: boolean]
}>()

const getTrackColor = (index: number) => {
  const { trackColors } = props.collection.theme
  if (Array.isArray(trackColors)) {
    return trackColors[index % trackColors.length]
  }
  return trackColors[props.song.tracks[index].id] || 'primary'
}

const state = {
  currentTime: ref<number>(0),
  lastSeekTime: ref<number>(0),
  totalDuration: ref<number>(0),
  playing: ref(false),
  trackStates: ref<{ isReady: boolean; volume: number }[]>(
    props.song.tracks.map(() => ({ isReady: false, volume: 1 }))
  )
}

// Track player refs
const trackPlayers = ref<any[]>([])

// Computed
const isReady = computed(() => state.trackStates.value.every((track) => track.isReady))

const seekAllTracks = (time: number) => {
  trackPlayers.value.forEach((player) => {
    if (player) {
      player.seekTo(time)
    }
  })
  state.currentTime.value = time
  emit('update:currentTime', time)
}

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
  state.trackStates.value[trackIndex].volume =
    state.trackStates.value[trackIndex].volume === 0 ? 1 : 0
}

const onSoloTrack = (index: number) => {
  const isCurrentlySoloed = state.trackStates.value.every(
    (track, i) => i === index || track.volume === 0
  )
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
  seekAllTracks(time)
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
    <div class="pt-2 pb-3 px-2 flex items-center justify-between gap-3 relative">
      <PlayerHeader :collection="collection" :song="song" />
      <div class="absolute top-2 left-1/2 -translate-x-1/2 flex items-center justify-end">
        <TimeCopier :currentTime="state.currentTime.value" />
      </div>
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
        :collection="collection"
        :enabledTracks="
          song.tracks
            .filter((_, i) => state.trackStates.value[i].volume > 0)
            .map((track) => track.id)
        "
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
                :color="getTrackColor(index)"
                :isReady="state.trackStates.value[index].isReady"
                :volume="state.trackStates.value[index].volume"
                :isPlaying="state.playing.value"
                :ref="(el) => (trackPlayers[index] = el)"
                @ready="(duration: number) => onReady(index, duration)"
                @time-update="(time: number) => onTimeUpdate(index, time)"
                @volume-change="(volume: number) => onVolumeChange(index, volume)"
                @toggle-track-muted="() => onToggleTrackMuted(index)"
                @toggle-track-solo="() => onSoloTrack(index)"
                @seek-to-time="onSeekToTime"
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
