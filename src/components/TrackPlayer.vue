<script setup lang="ts">
import type { Track } from '@/data/song.types'
import { WaveSurferPlayer } from '@meersagor/wavesurfer-vue'
import { $dt } from '@primevue/themes'
import { MicVocal, Volume2Icon, VolumeX } from 'lucide-vue-next'
import type { PartialWaveSurferOptions } from 'node_modules/@meersagor/wavesurfer-vue/dist/types/types'
import Button from 'primevue/button'
import Slider from 'primevue/slider'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type WaveSurfer from 'wavesurfer.js'

const props = defineProps<{
  track: Track
  color: string
  volume: number
  isReady: boolean
  isPlaying: boolean
  hasLyrics: boolean
  hasLyricsEnabled: boolean
}>()

const emit = defineEmits<{
  ready: [duration: number]
  'time-update': [time: number]
  finish: []
  'seek-to-time': [time: number]
  'volume-change': [volume: number]
  'toggle-track-muted': [toggleLyrics: boolean]
  'toggle-track-solo': [toggleLyrics: boolean]
  'toggle-lyrics': []
}>()

// State
const waveSurfer = ref<WaveSurfer | null>(null)
const isCtrlPressed = ref(false)
const isShiftPressed = ref(false)
const isMuted = computed(() => props.volume === 0)
const muteButtonLongPressTimer = ref<number | null>(null)
const isMuteButtonLongPressActive = ref(false)
const TOUCH_DURATION = 500 // 500ms for long press

// Methods
const seekTo = (time: number) => {
  if (!waveSurfer.value || !props.isReady) return
  waveSurfer.value.setTime(time)
}

const handleVolumeChange = (value: number | number[]) => {
  const newVolume = Array.isArray(value) ? value[0] : value
  const clampedVolume = Math.max(0, Math.min(1, newVolume))
  if (waveSurfer.value) {
    // For iOS Chrome, we need to ensure the audio element is accessible
    const audioElement = waveSurfer.value.getMediaElement()
    if (audioElement) {
      audioElement.volume = clampedVolume
    }
    waveSurfer.value.setVolume(clampedVolume)
  }
  emit('volume-change', clampedVolume)
}

defineExpose({
  seekTo
})

const sliderColorScheme = computed(() => {
  const color = isMuted.value ? 'zinc' : props.color
  return {
    colorScheme: {
      light: {
        root: {
          rangeBackground: `{${color}.500}`,
          handleBackground: `{${color}.500}`,
          handleHoverBackground: `{${color}.600}`,
          handleFocusRingColor: `{${color}.400}`
        }
      },
      dark: {
        root: {
          rangeBackground: `{${color}.400}`,
          handleBackground: `{${color}.400}`,
          handleHoverBackground: `{${color}.300}`,
          handleFocusRingColor: `{${color}.600}`
        }
      }
    }
  }
})

const getButtonColorScheme = (enabled: boolean) => {
  const baseColor = enabled ? props.color : 'zinc'
  const getScheme = (darkMode: boolean) => ({
    text: {
      primary: {
        color: `{${baseColor}.${darkMode ? '400' : '500'}}`,
        hoverBackground: `color-mix(in srgb, {${baseColor}.${darkMode ? '400' : '500'}}, transparent 90%)`,
        activeBackground: `color-mix(in srgb, {${baseColor}.${darkMode ? '400' : '500'}}, transparent 80%)`
      }
    }
  })

  return {
    colorScheme: {
      light: getScheme(false),
      dark: getScheme(true)
    }
  }
}

const waveSurferColorScheme = computed(() => {
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches
  const color = isMuted.value ? 'zinc' : props.color
  return {
    waveColor: isDarkMode ? $dt(`${color}.700`).value : $dt(`${color}.400`).value,
    progressColor: isDarkMode ? $dt(`${color}.500`).value : $dt(`${color}.600`).value
  }
})

// WaveSurfer Configuration
const waveSurferOptions = computed<PartialWaveSurferOptions>(() => {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
  return {
    height: 60,
    barGap: 2,
    barWidth: 2,
    barRadius: 8,
    dragToSeek: true,
    backend: isIOS ? 'MediaElement' : 'WebAudio',
    url: props.track.file,
    ...waveSurferColorScheme.value
  }
})

const handleLyricsButtonClick = () => {
  emit('toggle-lyrics')
}

const handleMuteButtonTouchStart = () => {
  isMuteButtonLongPressActive.value = false
  muteButtonLongPressTimer.value = window.setTimeout(() => {
    isMuteButtonLongPressActive.value = true
    emit('toggle-track-solo', !isShiftPressed.value)
  }, TOUCH_DURATION)
}

const handleMuteButtonTouchEnd = () => {
  if (muteButtonLongPressTimer.value) {
    clearTimeout(muteButtonLongPressTimer.value)
    muteButtonLongPressTimer.value = null
  }
}

const handleMuteButtonTouchCancel = () => {
  if (muteButtonLongPressTimer.value) {
    clearTimeout(muteButtonLongPressTimer.value)
    muteButtonLongPressTimer.value = null
  }
  isMuteButtonLongPressActive.value = false
}

const handleMuteButtonClick = (event: MouseEvent) => {
  // Prevent click handler from firing if it was a long press
  if (isMuteButtonLongPressActive.value) {
    event.preventDefault()
    return
  }

  if (isCtrlPressed.value) {
    emit('toggle-track-solo', !isShiftPressed.value)
  } else {
    emit('toggle-track-muted', !isShiftPressed.value)
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  const isMac = navigator.userAgent.indexOf('Mac') > 0
  if ((isMac && event.key === 'Meta') || (!isMac && event.key === 'Control')) {
    isCtrlPressed.value = true
  }
  if (event.key === 'Shift') {
    isShiftPressed.value = true
  }
}

const handleKeyup = (event: KeyboardEvent) => {
  const isMac = navigator.userAgent.indexOf('Mac') > 0
  if ((isMac && event.key === 'Meta') || (!isMac && event.key === 'Control')) {
    isCtrlPressed.value = false
  }
  if (event.key === 'Shift') {
    isShiftPressed.value = false
  }
}

watch(
  () => props.isPlaying,
  (newIsPlaying) => {
    if (!waveSurfer.value || !props.isReady) return
    if (newIsPlaying) {
      waveSurfer.value?.play()
    } else {
      waveSurfer.value?.pause()
    }
  }
)

watch(
  () => isMuted.value,
  () => {
    waveSurfer.value?.setOptions({
      ...waveSurferColorScheme.value
    })
  }
)

watch(
  () => props.volume,
  (newVolume) => {
    if (waveSurfer.value) {
      const clampedVolume = Math.max(0, Math.min(1, newVolume))
      waveSurfer.value.setVolume(clampedVolume)
    }
  },
  { immediate: true }
)

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('keyup', handleKeyup)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('keyup', handleKeyup)
  if (muteButtonLongPressTimer.value) {
    clearTimeout(muteButtonLongPressTimer.value)
  }
  waveSurfer.value?.destroy()
})
</script>

<template>
  <div class="flex items-start gap-2 w-full">
    <div class="min-w-0 w-20 sm:w-24 lg:w-32 xl:w-36 flex flex-col flex-shrink-0 gap-0">
      <div class="flex flex-row w-full gap-0 items-center justify-between">
        <span class="text-muted-color text-sm truncate text-ellipsis">
          {{ track.title }}
        </span>
        <Button
          v-if="hasLyrics"
          :disabled="!isReady"
          @click="handleLyricsButtonClick"
          text
          size="small"
          :dt="getButtonColorScheme(hasLyricsEnabled)"
          rounded
          class="aspect-square !w-7 !h-7 !p-0 flex-shrink-0"
        >
          <MicVocal class="w-4 h-4" />
        </Button>
      </div>
      <div class="flex flex-row w-full gap-3 items-center justify-between">
        <Slider
          :modelValue="volume"
          class="w-full"
          :min="0"
          :max="1"
          :step="0.01"
          :dt="sliderColorScheme"
          @update:modelValue="handleVolumeChange"
        />
        <Button
          :disabled="!isReady"
          @click="handleMuteButtonClick"
          @touchstart="handleMuteButtonTouchStart"
          @touchend="handleMuteButtonTouchEnd"
          @touchcancel="handleMuteButtonTouchCancel"
          text
          size="small"
          :dt="getButtonColorScheme(!isMuted)"
          rounded
          class="aspect-square !w-7 !h-7 !p-0 flex-shrink-0"
        >
          <Volume2Icon class="w-4 h-4" v-if="!isMuted" />
          <VolumeX class="w-4 h-4" v-else />
        </Button>
      </div>
    </div>
    <div class="w-full p-0">
      <WaveSurferPlayer
        :options="waveSurferOptions"
        @interaction="(time: number) => emit('seek-to-time', time)"
        @waveSurfer="(ws: WaveSurfer) => (waveSurfer = ws)"
        @ready="(duration: number) => emit('ready', duration)"
        @timeupdate="(time: number) => emit('time-update', time)"
        @finish="emit('finish')"
      />
    </div>
  </div>
</template>
