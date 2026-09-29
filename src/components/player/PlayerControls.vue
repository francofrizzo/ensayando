<script setup lang="ts">
import { IconPause, IconPlay, IconSkipNext, IconSkipPrev } from "@/components/ui/icons";

import type { Song } from "@/data/types";
import { formatTime } from "@/utils/datetime-utils";

const props = defineProps<{
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  isReady: boolean;
  prevSong: Song | null;
  nextSong: Song | null;
  compact?: boolean;
}>();

const emit = defineEmits<{
  "play-pause": [];
  "skip-prev": [];
  "skip-next": [];
}>();

const tenths = (time: number) => Math.floor((time % 1) * 10);
</script>

<template>
  <div class="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2">
    <div class="flex min-w-0 items-center">
      <span
        v-if="props.isReady"
        class="flex items-baseline font-mono leading-none tracking-tight whitespace-nowrap tabular-nums"
      >
        <span
          data-testid="time-display"
          class="text-base-content text-[18px] font-semibold lg:text-[22px]"
          >{{ formatTime(props.currentTime) }}</span
        ><span class="text-base-content/40 hidden text-[13px] sm:inline lg:text-[15px]"
          >.{{ tenths(props.currentTime) }}</span
        ><span class="text-base-content/60 ml-1.5 text-[15px] lg:text-[17px]"
          >/ {{ formatTime(props.totalDuration) }}</span
        >
      </span>
    </div>

    <div
      class="flex items-center gap-1.5 sm:gap-2.5"
      :class="
        props.compact
          ? ''
          : 'md:absolute md:top-0 md:left-1/2 md:-translate-x-1/2 md:-translate-y-[calc(50%-0.75rem)]'
      "
    >
      <button
        class="btn btn-circle"
        :class="props.compact ? 'btn-sm btn-ghost' : 'btn-md btn-ghost md:glass-3 md:size-9 md:border-0'"
        :disabled="!props.prevSong"
        aria-label="Canción anterior"
        @click="emit('skip-prev')"
      >
        <IconSkipPrev class="size-[18px] md:size-4" />
      </button>
      <button
        class="btn btn-circle btn-primary play-glow border-0"
        :class="[
          props.compact ? 'size-11' : 'size-14 md:size-16',
          !props.isReady && 'cursor-default'
        ]"
        aria-label="Play/Pause"
        @click="props.isReady && emit('play-pause')"
      >
        <span v-if="!props.isReady" class="loading loading-spinner loading-sm" />
        <Transition v-else name="player-icon" mode="out-in">
          <IconPause
            v-if="props.isPlaying"
            key="pause"
            :class="props.compact ? 'size-5' : 'size-6 md:size-7'"
          />
          <IconPlay
            v-else
            key="play"
            class="translate-x-[1px]"
            :class="props.compact ? 'size-5' : 'size-6 md:size-7'"
          />
        </Transition>
      </button>
      <button
        class="btn btn-circle"
        :class="props.compact ? 'btn-sm btn-ghost' : 'btn-md btn-ghost md:glass-3 md:size-9 md:border-0'"
        :disabled="!props.nextSong"
        aria-label="Canción siguiente"
        @click="emit('skip-next')"
      >
        <IconSkipNext class="size-[18px] md:size-4" />
      </button>
    </div>

    <div class="col-start-3 flex min-w-0 items-center justify-end gap-1.5">
      <slot />
    </div>
  </div>
</template>
