<script setup lang="ts">
import type { Track } from '@/data/song.types'
import { WaveSurferPlayer } from '@meersagor/wavesurfer-vue'
import { $dt } from '@primevue/themes'
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
}>()

const emit = defineEmits<{
  ready: [duration: number]
  'time-update': [time: number]
  'seek-to-time': [time: number]
  'volume-change': [volume: number]
  'toggle-track-muted': []
  'toggle-track-solo': []
}>()

// State
const waveSurfer = ref<WaveSurfer | null>(null)
const isCtrlPressed = ref(false)
const isMuted = computed(() => props.volume === 0)
const isIOS = computed(() => /iPad|iPhone|iPod/.test(navigator.userAgent))

// Methods
const seekTo = (time: number) => {
  if (!waveSurfer.value || !props.isReady) return
  waveSurfer.value.setTime(time)
}

const handleVolumeChange = (value: number | number[]) => {
  const newVolume = Array.isArray(value) ? value[0] : value
  const clampedVolume = Math.max(0, Math.min(1, newVolume))
  if (waveSurfer.value) {
    waveSurfer.value.setVolume(clampedVolume)
  }
  emit('volume-change', clampedVolume)
}

defineExpose({
  seekTo
})

const buttonColorScheme = computed(() => {
  const color = isMuted.value ? 'zinc' : props.color
  return {
    colorScheme: {
      light: {
        text: {
          primary: {
            color: `{${color}.600}`,
            hoverBackground: `color-mix(in srgb, {${color}.500}, transparent 90%)`,
            activeBackground: `color-mix(in srgb, {${color}.500}, transparent 80%)`
          }
        }
      },
      dark: {
        text: {
          primary: {
            color: `{${color}.400}`,
            hoverBackground: `color-mix(in srgb, {${color}.500}, transparent 90%)`,
            activeBackground: `color-mix(in srgb, {${color}.500}, transparent 80%)`
          }
        }
      }
    }
  }
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

const waveSurferColorScheme = computed(() => {
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches
  const color = isMuted.value ? 'zinc' : props.color
  return {
    waveColor: isDarkMode ? $dt(`${color}.700`).value : $dt(`${color}.400`).value,
    progressColor: isDarkMode ? $dt(`${color}.500`).value : $dt(`${color}.600`).value
  }
})

// WaveSurfer Configuration
const waveSurferOptions = computed<PartialWaveSurferOptions>(() => ({
  height: 60,
  barGap: 2,
  barWidth: 2,
  barRadius: 8,
  dragToSeek: false,
  backend: isIOS.value ? 'MediaElement' : 'WebAudio',
  url: props.track.file,
  ...waveSurferColorScheme.value
}))

const handleTrackButtonClick = () => {
  if (isCtrlPressed.value) {
    emit('toggle-track-solo')
  } else {
    emit('toggle-track-muted')
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  const isMac = navigator.userAgent.indexOf('Mac') > 0
  if ((isMac && event.key === 'Meta') || (!isMac && event.key === 'Control')) {
    isCtrlPressed.value = true
  }
}

const handleKeyup = (event: KeyboardEvent) => {
  const isMac = navigator.userAgent.indexOf('Mac') > 0
  if ((isMac && event.key === 'Meta') || (!isMac && event.key === 'Control')) {
    isCtrlPressed.value = false
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
  waveSurfer.value?.destroy()
})
</script>

<template>
  <div class="flex items-start gap-5 w-full">
    <div class="w-14 md:w-24 min-w-0 flex flex-grow-0 flex-shrink-0 flex-col justify-center gap-3">
      <Button
        :disabled="!isReady"
        @click="handleTrackButtonClick"
        text
        size="small"
        :dt="buttonColorScheme"
        :label="track.title"
        :pt="{
          label: { class: 'truncate ellipsis' }
        }"
      />

      <Slider
        :modelValue="volume"
        class="w-full"
        :min="0"
        :max="1"
        :step="0.01"
        :dt="sliderColorScheme"
        @update:modelValue="handleVolumeChange"
      />
    </div>
    <div class="w-full p-0">
      <WaveSurferPlayer
        :options="waveSurferOptions"
        @interaction="(time: number) => emit('seek-to-time', time)"
        @waveSurfer="(ws: WaveSurfer) => (waveSurfer = ws)"
        @ready="(duration: number) => emit('ready', duration)"
        @timeupdate="(time: number) => emit('time-update', time)"
      />
    </div>
  </div>
</template>
