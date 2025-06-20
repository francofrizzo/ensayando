<script setup lang="ts">
import type { AudioTrack, LyricVerse } from "@/data/types";
import { computed } from "vue";

const props = defineProps<{
  verse: LyricVerse;
  availableAudioTracks: AudioTrack[];
  maxTracks?: number;
}>();

const trackNames = computed(() => {
  return props.availableAudioTracks
    .filter((track) => props.verse.audio_track_ids?.includes(track.id))
    .map((track) => track.title);
});
</script>

<template>
  <div class="flex gap-2 justify-between text-xs text-base-content/40 mr-3 px-1 w-full">
    <div class="flex gap-1 font-mono">
      <span v-if="props.verse.start_time !== undefined">
        {{ Number(props.verse.start_time).toFixed(2) }}
      </span>
      <span v-if="props.verse.end_time !== undefined">-</span>
      <span v-if="props.verse.end_time !== undefined">
        {{ Number(props.verse.end_time).toFixed(2) }}
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
