<script setup lang="ts">
import ProgressSpinner from 'primevue/progressspinner'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

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
const syncInterval = ref<number | null>(null)
const SYNC_CHECK_INTERVAL = 1000 // Check every second
const DRIFT_THRESHOLD = 0.05 // 50ms drift threshold

// Computed
const isReady = computed(() => state.trackStates.value.every((track) => track.isReady))

const checkAndCorrectSync = () => {
  if (!state.playing.value || !isReady.value) return

  const times = trackPlayers.value.map((player) => player?.waveSurfer?.getCurrentTime() ?? 0)
  const mainTime = times[0] // Use first track as reference

  // Check if any track has drifted beyond threshold
  const needsSync = times.some((time) => Math.abs(time - mainTime) > DRIFT_THRESHOLD)

  if (needsSync) {
    console.debug('Correcting track sync, drift detected')
    seekAllTracks(mainTime)
  }
}

const startSyncCheck = () => {
  stopSyncCheck()
  syncInterval.value = window.setInterval(checkAndCorrectSync, SYNC_CHECK_INTERVAL)
}

const stopSyncCheck = () => {
  if (syncInterval.value) {
    window.clearInterval(syncInterval.value)
    syncInterval.value = null
  }
}

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
  const clampedVolume = Math.max(0, Math.min(1, volume))
  state.trackStates.value[trackIndex].volume = clampedVolume
}

const onToggleTrackMuted = (trackIndex: number) => {
  const newVolume = state.trackStates.value[trackIndex].volume === 0 ? 1 : 0
  onVolumeChange(trackIndex, newVolume)
}

const onSoloTrack = (index: number) => {
  const isCurrentlySoloed = state.trackStates.value.every(
    (track, i) => i === index || track.volume === 0
  )

  state.trackStates.value.forEach((_, i) => {
    const newVolume = isCurrentlySoloed ? 1 : i === index ? 1 : 0
    onVolumeChange(i, newVolume)
  })
}

const onPlayPause = async (forcePlay?: boolean) => {
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

watch(
  () => state.playing.value,
  (isPlaying) => {
    if (isPlaying) {
      startSyncCheck()
    } else {
      stopSyncCheck()
    }
  }
)

onMounted(() => {
  window.addEventListener('keydown', keydownHandler)
})

onUnmounted(() => {
  window.removeEventListener('keydown', keydownHandler)
  stopSyncCheck()
})
</script>

<template>
  <div class="bg-surface-50 dark:bg-surface-950 flex w-full h-dvh flex-col p-2">
    <div class="pt-2 pb-3 px-2 flex items-center justify-between gap-3 relative">
      <PlayerHeader :collection="collection" :song="song" />
      <PlayerControls
        :currentTime="state.currentTime.value"
        :totalDuration="state.totalDuration.value"
        :isPlaying="state.playing.value"
        :isReady="isReady"
        @play-pause="onPlayPause"
      />
      <div class="absolute top-2 left-1/2 -translate-x-1/2 flex items-center justify-end">
        <TimeCopier :currentTime="state.currentTime.value" />
      </div>
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
      class="relative border border-surface-200 dark:border-surface-800 rounded-lg bg-surface-100 dark:bg-surface-900 md:m-3 shadow-sm max-h-[420px]"
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
        class="absolute top-0 left-0 bottom-0 right-0 z-10 bg-surface-200 dark:bg-surface-800 rounded opacity-80 flex flex-col gap-6 text-lg items-center justify-center"
      >
        <ProgressSpinner />
        <span class="text-muted uppercase text-muted-color tracking-wide">Cargando...</span>
      </div>
    </div>
  </div>
</template>
