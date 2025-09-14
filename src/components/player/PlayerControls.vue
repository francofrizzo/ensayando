<script setup lang="ts">
import { Copy, Pause, Play, RefreshCcw } from "lucide-vue-next";

import { formatTime } from "@/utils/datetime-utils";

const props = defineProps<{
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  isReady: boolean;
  editMode?: boolean;
  autoplayEnabled: boolean;
}>();

const emit = defineEmits<{
  "play-pause": [];
  "toggle-autoplay": [];
}>();

const copyTimeToClipboard = () => {
  navigator.clipboard.writeText(props.currentTime.toFixed(2));
};
</script>

<template>
  <div class="flex items-center gap-5 text-right tracking-wide tabular-nums">
    <div class="flex items-baseline">
      <span class="text-base-content/90 cursor-default text-xl transition-colors">{{
        formatTime(props.currentTime)
      }}</span>
      <span class="text-base-content/50 text-md hidden cursor-default transition-colors sm:inline"
        >.{{ props.currentTime.toFixed(2).split(".")[1] }}</span
      >

      <span class="text-base-content/70 mx-1 hidden text-xl sm:inline">/</span>
      <span class="text-base-content/50 hidden cursor-default transition-colors sm:inline">{{
        formatTime(props.totalDuration)
      }}</span>
      <span class="text-base-content/30 hidden cursor-default text-xs transition-colors sm:inline"
        >.{{ props.totalDuration.toFixed(2).split(".")[1] }}</span
      >
      <button
        v-if="props.editMode"
        class="btn btn-sm btn-square btn-soft ml-3"
        @click="copyTimeToClipboard"
      >
        <Copy class="size-3.5" />
      </button>
    </div>
    <div class="flex items-center gap-3">
      <button
        class="btn btn-circle btn-primary btn-lg flex-shrink-0"
        :disabled="!props.isReady"
        rounded
        aria-label="Play/Pause"
        @click="() => emit('play-pause')"
      >
        <Pause v-if="props.isPlaying" class="h-5 w-5" />
        <Play v-else class="h-5 w-5" />
      </button>
      <button
        class="btn btn-circle btn-sm flex-shrink-0"
        :class="{ 'btn-primary': props.autoplayEnabled, 'btn-soft': !props.autoplayEnabled }"
        :disabled="!props.isReady"
        aria-label="Toggle Autoplay"
        @click="() => emit('toggle-autoplay')"
      >
        <RefreshCcw class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>
