<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'
import ProgressSpinner from 'primevue/progressspinner'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import LyricsViewer from '@/components/LyricsViewer.vue'
import PlayerControls from '@/components/PlayerControls.vue'
import PlayerHeader from '@/components/PlayerHeader.vue'
import TimeCopier from '@/components/TimeCopier.vue'
import TrackPlayer from '@/components/TrackPlayer.vue'
import { useMediaSession } from '@/composables/useMediaSession'
import type { Collection } from '@/data/collection.types'
import type { Song } from '@/data/song.types'

const props = defineProps<{
  collection: Collection
  song: Song
}>()

const getTrackColor = (index: number) => {
  const { trackColors } = props.collection.theme
  if (Array.isArray(trackColors)) {
    return trackColors[index % trackColors.length]
  }
  return trackColors[props.song.tracks[index].id] || 'primary'
}

const getLyricTracks = () => {
  const tracks = new Set<string>()
  props.song.lyrics.forEach((lyricGroup) => {
    lyricGroup.forEach((item) => {
      if (Array.isArray(item)) {
        item.forEach((lyricColumn) => {
          lyricColumn.forEach((lyric) => {
            lyric.tracks?.forEach((trackId) => tracks.add(trackId))
          })
        })
      } else {
        item.tracks?.forEach((trackId) => tracks.add(trackId))
      }
    })
  })
  return Array.from(tracks)
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

const lyricTracks = ref<Record<string, boolean>>(
  getLyricTracks().reduce(
    (acc, id) => {
      acc[id] = true
      return acc
    },
    {} as Record<string, boolean>
  )
)

const trackPlayers = ref<any[]>([])
const syncInterval = ref<number | null>(null)
const SYNC_CHECK_INTERVAL = 1000 // Check every second
const DRIFT_THRESHOLD = 0.05 // 50ms drift threshold
const hasInitializedAudio = ref(false)
const silentAudio = ref<HTMLAudioElement | null>(null)

const areTrackPlayersVisible = ref(true)

const initializeAudioContext = () => {
  // Only run once and only on iOS
  if (hasInitializedAudio.value || !/iPhone|iPad|iPod/.test(navigator.userAgent)) {
    return Promise.resolve()
  }

  // Create silent audio element
  silentAudio.value = new Audio()
  // Use a very short mp3 data URI
  silentAudio.value.src =
    'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAAwAAAQABAQEBAQEBAQEBAQEBAQEBAQEB'
  silentAudio.value.load()
  hasInitializedAudio.value = true
  return Promise.resolve()
}

const isReady = computed(() => state.trackStates.value.every((track) => track.isReady))

// Setup Media Session
const mediaSessionOptions = computed(() => ({
  title: props.song.title,
  artist: props.collection.artist || props.song.artist || '',
  album: props.collection.title,
  artwork: props.collection.artwork || props.song.artwork,
  duration: state.totalDuration.value
}))

const {
  currentTime: mediaSessionTime,
  isPlaying: mediaSessionPlaying,
  initMediaSession,
  cleanupMediaSession
} = useMediaSession(mediaSessionOptions, {
  onPlay: () => onPlayPause(true),
  onPause: () => onPlayPause(false),
  onSeek: (time) => onSeekToTime(time)
})

// Sync media session with player state
watch(
  () => state.currentTime.value,
  (time) => {
    mediaSessionTime.value = time
  }
)

watch(
  () => state.playing.value,
  (playing) => {
    mediaSessionPlaying.value = playing
  }
)

// Listen to media session controls
watch(mediaSessionPlaying, (playing) => {
  if (playing !== state.playing.value) {
    state.playing.value = playing
  }
})

watch(mediaSessionTime, (time) => {
  if (Math.abs(time - state.currentTime.value) > 0.1) {
    seekAllTracks(time)
  }
})

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
  }
}

const onFinish = (trackIndex: number) => {
  if (trackIndex === 0) {
    state.playing.value = false
  }
}

const onVolumeChange = (trackIndex: number, volume: number) => {
  const clampedVolume = Math.max(0, Math.min(1, volume))
  state.trackStates.value[trackIndex].volume = clampedVolume
  if (state.trackStates.value[trackIndex].volume > 0) {
    onSetTrackLyricsEnabled(props.song.tracks[trackIndex]?.id, true)
  } else {
    onSetTrackLyricsEnabled(props.song.tracks[trackIndex]?.id, false)
  }
}

const onToggleTrackMuted = (trackIndex: number, toggleLyrics: boolean) => {
  const shouldBeEnabled = state.trackStates.value[trackIndex].volume === 0
  const newVolume = shouldBeEnabled ? 1 : 0
  onVolumeChange(trackIndex, newVolume)
  if (toggleLyrics) {
    onSetTrackLyricsEnabled(props.song.tracks[trackIndex]?.id, shouldBeEnabled)
  }
}

const onSoloTrack = (index: number, toggleLyrics: boolean) => {
  const isCurrentlySoloed = state.trackStates.value.every(
    (track, i) => i === index || track.volume === 0
  )

  state.trackStates.value.forEach((_, i) => {
    const shouldBeEnabled = i === index || isCurrentlySoloed
    const newVolume = shouldBeEnabled ? 1 : 0
    onVolumeChange(i, newVolume)
    if (toggleLyrics) {
      onSetTrackLyricsEnabled(props.song.tracks[i]?.id, shouldBeEnabled)
    }
  })
}

const onSetTrackLyricsEnabled = (trackId: string, newState: boolean) => {
  if (trackId in lyricTracks.value) {
    lyricTracks.value[trackId] = newState
  }
}

const onToggleTrackLyrics = (trackId: string) => {
  onSetTrackLyricsEnabled(trackId, !lyricTracks.value[trackId])
}

const onPlayPause = async (forcePlay?: boolean) => {
  // Initialize audio context for iOS
  if (!hasInitializedAudio.value) {
    try {
      await initializeAudioContext()
      // Try to play silent audio without waiting for it to complete
      silentAudio.value?.play().catch(() => {
        console.debug('Silent audio play was blocked or failed')
      })
    } catch (e) {
      console.error('Failed to initialize audio context:', e)
    }
  }

  state.playing.value = forcePlay ?? !state.playing.value
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

// Update playback state when playing state changes
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
  initMediaSession()
})

onUnmounted(() => {
  window.removeEventListener('keydown', keydownHandler)
  stopSyncCheck()
  cleanupMediaSession()
})
</script>

<template>
  <div
    class="bg-surface-50 dark:bg-surface-950 flex w-full h-dvh flex-col md:gap-3 lg:gap-4 md:p-3 lg:p-4 select-none"
  >
    <div class="p-3 md:p-0 md:pb-3 flex items-center justify-between gap-3 relative">
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

    <div class="h-full flex-grow-1 overflow-auto px-10">
      <LyricsViewer
        :lyrics="song.lyrics"
        :currentTime="state.currentTime.value"
        :isDisabled="!isReady"
        :collection="collection"
        :tracks="lyricTracks"
        @seek="onSeekToTime"
      />
    </div>

    <div
      class="relative border-t md:border border-surface-200 dark:border-surface-800 md:rounded-lg bg-surface-100 dark:bg-surface-900 shadow-sm transition-[max-height] duration-300"
      :class="{ 'max-h-[45%]': areTrackPlayersVisible, 'max-h-[4px]': !areTrackPlayersVisible }"
    >
      <div class="h-full overflow-hidden">
        <div class="h-full overflow-y-auto p-3">
          <TrackPlayer
            v-for="(track, index) in song.tracks"
            :key="index"
            :track="track"
            :color="getTrackColor(index)"
            :isReady="state.trackStates.value[index].isReady"
            :volume="state.trackStates.value[index].volume"
            :isPlaying="state.playing.value"
            :hasLyrics="lyricTracks[track.id] !== undefined"
            :hasLyricsEnabled="lyricTracks[track.id] ?? false"
            :ref="(el) => (trackPlayers[index] = el)"
            @ready="(duration: number) => onReady(index, duration)"
            @time-update="(time: number) => onTimeUpdate(index, time)"
            @volume-change="(volume: number) => onVolumeChange(index, volume)"
            @toggle-track-muted="(toggleLyrics: boolean) => onToggleTrackMuted(index, toggleLyrics)"
            @toggle-track-solo="(toggleLyrics: boolean) => onSoloTrack(index, toggleLyrics)"
            @toggle-lyrics="() => onToggleTrackLyrics(track.id)"
            @seek-to-time="onSeekToTime"
            @finish="onFinish(index)"
          />
        </div>
      </div>

      <div class="absolute inset-x-0 top-0 -mt-6 h-6 pointer-events-none flex justify-center z-10">
        <button
          class="p-2 pointer-events-auto bg-surface-100 dark:bg-surface-900 text-surface-500 dark:text-surface-500 rounded-t-xl w-16 flex items-center justify-center border-t border-r border-l border-surface-200 dark:border-surface-800"
          @click="areTrackPlayersVisible = !areTrackPlayersVisible"
        >
          <ChevronDown
            class="w-7 h-7 transition-transform duration-300"
            :class="{ 'rotate-180': !areTrackPlayersVisible }"
          />
        </button>
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
