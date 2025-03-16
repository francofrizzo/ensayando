<script setup lang="ts">
import type { Track } from '@/data/song.types'
import type { PartialWaveSurferOptions } from 'node_modules/@meersagor/wavesurfer-vue/dist/types/types'
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import type WaveSurfer from 'wavesurfer.js'
import Slider from 'primevue/slider'
import Button from 'primevue/button'
import { WaveSurferPlayer } from '@meersagor/wavesurfer-vue'
import { $dt } from '@primevue/themes'

const props = defineProps<{
  track: Track
  index: number
  volume: number
  isReady: boolean
  isPlaying: boolean
  lastSeekTime: number
}>()

const emit = defineEmits<{
  ready: [index: number, duration: number]
  'time-update': [index: number, time: number]
  'volume-change': [index: number, volume: number]
  'seek-to-time': [time: number]
  'solo-track': [index: number]
  'toggle-track-muted': [index: number]
}>()

// State
const waveSurfer = ref<WaveSurfer | null>(null)
const isCtrlPressed = ref(false)
const isMuted = computed(() => props.volume === 0)

const trackColors = ['emerald', 'amber', 'sky', 'rose', 'indigo', 'lime']
const getTrackColor = (index: number) => trackColors[index % trackColors.length]

const getButtonColorScheme = (index: number, muted = false) => {
  const color = muted ? 'zinc' : getTrackColor(index)
  return {
    colorScheme: {
      light: {
        text: {
          primary: {
            hoverBackground: `color-mix(in srgb, {${color}.500}, transparent 96%)`,
            activeBackground: `color-mix(in srgb, {${color}.500}, transparent 84%)`,
            color: `{${color}.50}`
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
}

const getSliderColorScheme = (index: number, muted = false) => {
  const color = muted ? 'zinc' : getTrackColor(index)
  return {
    colorScheme: {
      light: {
        root: {
          rangeBackground: `{${color}.500}`,
          handleBackground: `{${color}.500}`,
          handleHoverBackground: `{${color}.600}`
        }
      },
      dark: {
        root: {
          rangeBackground: `{${color}.400}`,
          handleBackground: `{${color}.400}`,
          handleHoverBackground: `{${color}.300}`
        }
      }
    }
  }
}

const getWaveSurferColorScheme = (index: number, muted = false) => {
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches
  const color = muted ? 'zinc' : getTrackColor(index)
  return {
    waveColor: isDarkMode ? $dt(`${color}.700`).value : $dt(`${color}.300`).value,
    progressColor: isDarkMode ? $dt(`${color}.500`).value : $dt(`${color}.400`).value
  }
}

// WaveSurfer Configuration
const waveSurferOptions = computed<PartialWaveSurferOptions>(() => ({
  height: 72,
  barGap: 2,
  barWidth: 2,
  barRadius: 8,
  dragToSeek: false,
  backend: 'WebAudio',
  url: props.track.file,
  ...getWaveSurferColorScheme(props.index, isMuted.value),
}))

const handleTrackButtonClick = (index: number) => {
  if (isCtrlPressed.value) {
    emit('solo-track', index)
  } else {
    emit('toggle-track-muted', index)
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

watch(() => props.isPlaying, (newIsPlaying) => {
  if (!waveSurfer.value || !props.isReady) return
  if (newIsPlaying) {
    waveSurfer.value?.play()
  } else {
    waveSurfer.value?.pause()
  }
})

watch(() => isMuted.value, (newIsMuted) => {
  waveSurfer.value?.setOptions({
    ...getWaveSurferColorScheme(props.index, newIsMuted)
  })
})

watch(() => props.volume, (newVolume) => {
  waveSurfer.value?.setVolume(newVolume)
})

watch(() => props.lastSeekTime, (newLastSeekTime) => {
  waveSurfer.value?.setTime(newLastSeekTime)
})

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
  <div class="flex items-start gap-6 w-full">
    <div class="w-14 md:w-24 min-w-0 flex flex-grow-0 flex-shrink-0 flex-col justify-center gap-3">
      <div class="flex items-center gap-2">
        <Button
          class="text-ellipsis overflow-hidden text-left justify-start w-full whitespace-nowrap"
          :label="track.title"
          :disabled="!isReady"
          @click="() => handleTrackButtonClick(index)"
          :text="true"
          size="small"
          :dt="getButtonColorScheme(index, isMuted)"
        />
      </div>

      <Slider
        :modelValue="volume"
        class="w-full"
        :min="0"
        :max="1"
        :step="0.01"
        :dt="getSliderColorScheme(index, isMuted)"
        @update:modelValue="(value: number) => emit('volume-change', index, value)"
      />
    </div>
    <div class="w-full p-0">
      <WaveSurferPlayer
        :options="waveSurferOptions"
        @interaction="(time: number) => emit('seek-to-time', time)"
        @waveSurfer="(ws: WaveSurfer) => (waveSurfer = ws)"
        @ready="(duration: number) => emit('ready', index, duration)"
        @timeupdate="(time: number) => emit('time-update', index, time)"
      />
    </div>
  </div>
</template>
