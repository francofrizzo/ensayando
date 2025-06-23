<script setup lang="ts">
import type { AudioTrack, LyricVerse } from "@/data/types";
import { computed } from "vue";

const props = defineProps<{
  verse: LyricVerse;
  availableAudioTracks: AudioTrack[];
  maxTracks?: number;
  onUpdateStartTime?: (value: number | undefined) => void;
  onUpdateEndTime?: (value: number | undefined) => void;
}>();

const trackNames = computed(() => {
  return props.availableAudioTracks
    .filter((track) => props.verse.audio_track_ids?.includes(track.id))
    .map((track) => track.title);
});

const handleStartTimeInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const value = target.value.trim();

  if (props.onUpdateStartTime) {
    if (value === "") {
      props.onUpdateStartTime(undefined);
    } else {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue >= 0) {
        props.onUpdateStartTime(numValue);
      }
    }
  }
};

const handleEndTimeInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const value = target.value.trim();

  if (props.onUpdateEndTime) {
    if (value === "") {
      props.onUpdateEndTime(undefined);
    } else {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue >= 0) {
        props.onUpdateEndTime(numValue);
      }
    }
  }
};

const formatTimeValue = (time: number | undefined): string => {
  return time !== undefined ? Number(time).toFixed(2) : "";
};
</script>

<template>
  <div class="text-base-content/40 mr-3 flex w-full justify-between gap-2 px-1 text-xs">
    <div class="flex items-center gap-1 font-mono">
      <input
        v-if="props.onUpdateStartTime"
        type="number"
        min="0"
        step="0.01"
        format="0.00"
        :value="props.verse.start_time"
        placeholder="inicio"
        data-timestamps-input
        class="no-spinner text-base-content/40 focus:text-base-content/80 hover:text-base-content/60 field-sizing-fallback-12 field-sizing-content border-none bg-transparent font-mono text-xs outline-none"
        @input="handleStartTimeInput"
        @blur="handleStartTimeInput"
      />
      <span v-else-if="props.verse.start_time !== undefined">
        {{ props.verse.start_time }}
      </span>

      <span
        v-if="
          props.verse.end_time !== undefined ||
          props.verse.start_time !== undefined ||
          props.onUpdateStartTime
        "
        >-</span
      >

      <input
        v-if="props.onUpdateEndTime"
        type="number"
        step="0.01"
        format="0.00"
        min="0"
        :value="props.verse.end_time"
        placeholder="fin"
        data-timestamps-input
        class="no-spinner text-base-content/40 focus:text-base-content/80 hover:text-base-content/60 field-sizing-fallback-12 field-sizing-content border-none bg-transparent font-mono text-xs outline-none"
        @input="handleEndTimeInput"
        @blur="handleEndTimeInput"
      />
      <span v-else-if="props.verse.end_time !== undefined">
        {{ props.verse.end_time }}
      </span>
    </div>
    <span v-if="trackNames.length > 0" class="whitespace-nowrap">
      <div v-if="props.maxTracks && trackNames.length > props.maxTracks">
        {{ trackNames.slice(0, props.maxTracks).join(", ") }}
        <span v-if="trackNames.length > props.maxTracks" class="text-base-content/25"
          >+{{ trackNames.length - props.maxTracks }}</span
        >
      </div>
      <div v-else>
        {{ trackNames.join(", ") }}
      </div>
    </span>
  </div>
</template>
