<script setup lang="ts">
import { IconPause, IconPlay, IconSkipPrev, IconSkipNext } from "@/components/ui/icons";

import type { Song } from "@/data/types";
import { formatTime } from "@/utils/datetime-utils";

const props = defineProps<{
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  isReady: boolean;
  prevSong: Song | null;
  nextSong: Song | null;
}>();

const emit = defineEmits<{
  "play-pause": [];
  "skip-prev": [];
  "skip-next": [];
}>();
</script>

<template>
  <div class="flex items-center gap-5 text-right tracking-wide tabular-nums">
    <Transition name="time-reveal">
      <div v-if="props.isReady" class="flex items-baseline">
        <span data-testid="time-display" class="relative cursor-default text-xl transition-colors"
          ><span
            v-if="props.isPlaying"
            class="bg-primary absolute top-1/2 -left-4 size-2 -translate-y-1/2 animate-pulse rounded-full"
          /><span class="text-base-content/90">{{ formatTime(props.currentTime) }}</span></span
        >
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
      </div>
    </Transition>
    <div class="flex items-center gap-1">
      <button
        class="btn btn-circle btn-ghost btn-sm flex-shrink-0"
        :disabled="!props.prevSong"
        aria-label="Canción anterior"
        @click="() => emit('skip-prev')"
      >
        <IconSkipPrev class="size-4" />
      </button>
      <button
        :class="[
          'btn btn-circle btn-primary btn-lg flex-shrink-0',
          !props.isReady && 'cursor-default'
        ]"
        aria-label="Play/Pause"
        @click="() => props.isReady && emit('play-pause')"
      >
        <span v-if="!props.isReady" class="loading loading-spinner loading-sm" />
        <Transition v-else name="player-icon" mode="out-in">
          <IconPause v-if="props.isPlaying" key="pause" class="h-5 w-5" />
          <IconPlay v-else key="play" class="h-5 w-5 translate-x-[1px]" />
        </Transition>
      </button>
      <button
        class="btn btn-circle btn-ghost btn-sm flex-shrink-0"
        :disabled="!props.nextSong"
        aria-label="Canción siguiente"
        @click="() => emit('skip-next')"
      >
        <IconSkipNext class="size-4" />
      </button>
    </div>
  </div>
</template>
