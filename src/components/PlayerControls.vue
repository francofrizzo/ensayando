<script setup lang="ts">
import Button from 'primevue/button'

const props = defineProps<{
  currentTime: number
  totalDuration: number
  isPlaying: boolean
  isReady: boolean
}>()

const emit = defineEmits<{
  'play-pause': []
}>()

const formatTime = (seconds: number): string =>
  [seconds / 60, seconds % 60].map((v) => `${Math.floor(v)}`.padStart(2, '0')).join(':')

const copyTimeToClipboard = async (seconds: number) => {
  const formattedSeconds = seconds.toFixed(2)
  await navigator.clipboard.writeText(formattedSeconds)
}
</script>

<template>
  <div class="flex items-center gap-5 text-right">
    <div class="flex items-baseline">
      <span
        class="text-surface-200 text-xl cursor-default transition-colors"
        @click="copyTimeToClipboard(currentTime)"
        title="Click to copy time in seconds"
        >{{ formatTime(currentTime) }}</span
      >
      <span
        class="text-surface-500 text-md cursor-default transition-colors"
        @click="copyTimeToClipboard(currentTime)"
        title="Click to copy time in seconds"
        >.{{ currentTime.toFixed(2).split('.')[1] }}</span
      >
      <span class="text-surface-300 text-xl mx-1">/</span>
      <span
          class="text-surface-400 cursor-default transition-colors"
        @click="copyTimeToClipboard(totalDuration)"
        title="Click to copy time in seconds"
        >{{ formatTime(totalDuration) }}</span
      >
      <span
        class="text-surface-600 text-xs cursor-default transition-colors"
        @click="copyTimeToClipboard(totalDuration)"
        title="Click to copy time in seconds"
        >.{{ totalDuration.toFixed(2).split('.')[1] }}</span
      >
    </div>
    <Button
      class="flex-shrink-0 aspect-square"
      :icon="isPlaying ? 'pi pi-pause' : 'pi pi-play'"
      @click="() => emit('play-pause')"
      :disabled="!isReady"
      rounded
      aria-label="Play/Pause"
    />
  </div>
</template>
