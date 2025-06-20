<script setup lang="ts">
import { Copy, Pause, Play } from "lucide-vue-next";

import { formatTime } from "@/utils/utils";

const props = defineProps<{
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  isReady: boolean;
  editMode?: boolean;
}>();

const emit = defineEmits<{
  "play-pause": [];
}>();

const copyTimeToClipboard = () => {
  navigator.clipboard.writeText(props.currentTime.toFixed(2));
};
</script>

<template>
  <div class="flex items-center gap-5 text-right tracking-wide tabular-nums">
    <div class="flex items-baseline">
      <span class="text-base-content/90 text-xl cursor-default transition-colors">{{
        formatTime(props.currentTime)
      }}</span>
      <span class="hidden sm:inline text-base-content/50 text-md cursor-default transition-colors"
        >.{{ props.currentTime.toFixed(2).split(".")[1] }}</span
      >

      <span class="hidden sm:inline text-base-content/70 text-xl mx-1">/</span>
      <span class="hidden sm:inline text-base-content/50 cursor-default transition-colors">{{
        formatTime(props.totalDuration)
      }}</span>
      <span class="hidden sm:inline text-base-content/30 text-xs cursor-default transition-colors"
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
    <button
      class="btn btn-circle btn-primary btn-lg flex-shrink-0"
      :disabled="!props.isReady"
      rounded
      aria-label="Play/Pause"
      @click="() => emit('play-pause')"
    >
      <Pause v-if="props.isPlaying" class="w-5 h-5" />
      <Play v-else class="w-5 h-5" />
    </button>
  </div>
</template>
