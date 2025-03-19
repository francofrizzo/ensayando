<script setup lang="ts">
import { formatTime } from '@/utils/utils'
import { Pause, Play } from 'lucide-vue-next'
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
</script>

<template>
  <div class="flex items-center gap-5 text-right font-mono">
    <div class="flex items-baseline">
      <span
        class="text-surface-600 dark:text-surface-200 text-xl cursor-default transition-colors"
        >{{ formatTime(currentTime) }}</span
      >
      <span
        class="hidden sm:inline text-surface-500 dark:text-surface-500 text-md cursor-default transition-colors"
        >.{{ currentTime.toFixed(2).split('.')[1] }}</span
      >

      <span class="hidden sm:inline text-surface-400 dark:text-surface-300 text-xl mx-1">/</span>
      <span
        class="hidden sm:inline text-surface-500 dark:text-surface-400 cursor-default transition-colors"
        >{{ formatTime(totalDuration) }}</span
      >
      <span
        class="hidden sm:inline text-surface-400 dark:text-surface-600 text-xs cursor-default transition-colors"
        >.{{ totalDuration.toFixed(2).split('.')[1] }}</span
      >
    </div>
    <Button
      class="flex-shrink-0 aspect-square"
      @click="() => emit('play-pause')"
      :disabled="!isReady"
      rounded
      aria-label="Play/Pause"
    >
      <Pause v-if="isPlaying" class="w-5 h-5" />
      <Play v-else class="w-5 h-5" />
    </Button>
  </div>
</template>
