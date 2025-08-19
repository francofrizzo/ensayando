<script setup lang="ts">
import { WaveSurferPlayer } from "@meersagor/wavesurfer-vue";
import { Hash, MicVocal, Volume2Icon, VolumeX } from "lucide-vue-next";
import type { PartialWaveSurferOptions } from "node_modules/@meersagor/wavesurfer-vue/dist/types/types";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import type WaveSurfer from "wavesurfer.js";

import type { AudioTrack, CollectionWithRole } from "@/data/types";
import { darken, lighten } from "@/utils/color-utils";

const props = defineProps<{
  collection: CollectionWithRole;
  track: AudioTrack;
  volume: number;
  isReady: boolean;
  isPlaying: boolean;
  hasLyrics: boolean;
  lyricsEnabled: boolean;
  editMode?: boolean;
  audioContext?: AudioContext;
}>();

const emit = defineEmits<{
  ready: [duration: number];
  "time-update": [time: number];
  finish: [];
  seek: [time: number];
  "volume-change": [volume: number];
  "toggle-muted": [toggleLyrics: boolean];
  "toggle-solo": [toggleLyrics: boolean];
  "toggle-lyrics": [];
}>();

// State
const waveSurfer = ref<WaveSurfer | null>(null);
const muteButtonLongPressTimer = ref<number | null>(null);
const isMuteButtonLongPressActive = ref(false);
const TOUCH_DURATION = 500; // 500ms for long press
const isMac = navigator.userAgent.indexOf("Mac") > 0;
const isMuted = computed(() => props.volume === 0);
const peaksData = ref<any | null>(null);
const knownDurationSeconds = ref<number | null>(null);

// Methods
const handleTrackError = (error: Error, context: string) => {
  console.error(`Track ${props.track.id} error in ${context}:`, error);
};

const seekTo = (time: number) => {
  if (!waveSurfer.value || !props.isReady) return;

  try {
    // Check if waveSurfer is actually ready to accept setTime calls
    if (waveSurfer.value.getDuration() > 0) {
      waveSurfer.value.setTime(time);
    }
  } catch (error) {
    handleTrackError(error as Error, "seekTo");
  }
};

const handleVolumeChange = (value: number | number[]) => {
  const newVolume = Array.isArray(value) ? (value[0] ?? 0) : value;
  const clampedVolume = Math.max(0, Math.min(1, newVolume));
  if (waveSurfer.value) {
    waveSurfer.value.setVolume(clampedVolume);
  }
  emit("volume-change", clampedVolume);
};

defineExpose({
  waveSurfer,
  seekTo
});

const trackColor = computed(() => {
  return props.collection.track_colors[props.track.color_key] ?? props.collection.main_color;
});
const disabledColor = computed(() => {
  const rootStyle = getComputedStyle(document.documentElement);
  return rootStyle.getPropertyValue("--color-zinc-500").trim();
});
const color = computed(() => {
  return isMuted.value ? disabledColor.value : trackColor.value;
});

const waveSurferColorScheme = computed(() => {
  const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return {
    waveColor: isDarkMode ? darken(color.value, 0.3) : lighten(color.value, 0.4),
    progressColor: color.value
  };
});

const waveSurferOptions = computed<PartialWaveSurferOptions>(() => {
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);
  return {
    height: 64,
    barGap: isIOS ? 1.5 : 2,
    barWidth: isIOS ? 2 : 3,
    barRadius: 8,
    dragToSeek: true,
    backend: "WebAudio",
    url: props.track.audio_file_url,
    ...(props.audioContext ? { audioContext: props.audioContext } : {}),
    // If we have precomputed peaks/duration, pass them to reduce decoding
    ...(peaksData.value ? { peaks: peaksData.value } : ({} as any)),
    ...(props.track.duration_seconds
      ? { duration: props.track.duration_seconds }
      : knownDurationSeconds.value
        ? { duration: knownDurationSeconds.value }
        : ({} as any)),
    ...waveSurferColorScheme.value
  };
});

// Prefetch peaks JSON if provided
const loadPeaksIfAvailable = async () => {
  try {
    if (!props.track.peaks_file_url) {
      peaksData.value = null;
      knownDurationSeconds.value = null;
      return;
    }
    const response = await fetch(props.track.peaks_file_url, { cache: "force-cache" });
    const json = await response.json();
    if (Array.isArray(json)) {
      peaksData.value = json;
    } else if (json && (Array.isArray(json.data) || Array.isArray(json.channels))) {
      // Support { data: [...] } or { channels: [[...], ...] }
      peaksData.value = json.data ?? json.channels;
      if (typeof json.duration === "number") {
        knownDurationSeconds.value = json.duration;
      }
    } else {
      peaksData.value = null;
    }
  } catch (e) {
    console.debug("Failed to load peaks JSON", e);
    peaksData.value = null;
  }
};

onMounted(() => {
  loadPeaksIfAvailable();
});

watch(
  () => props.track.peaks_file_url,
  () => {
    loadPeaksIfAvailable();
  }
);

const handleLyricsButtonClick = () => {
  emit("toggle-lyrics");
};

const handleMuteButtonTouchStart = () => {
  isMuteButtonLongPressActive.value = false;
  muteButtonLongPressTimer.value = window.setTimeout(() => {
    isMuteButtonLongPressActive.value = true;
    emit("toggle-solo", false); // Touch events don't have shift key context
  }, TOUCH_DURATION);
};

const handleMuteButtonTouchEnd = () => {
  if (muteButtonLongPressTimer.value) {
    clearTimeout(muteButtonLongPressTimer.value);
    muteButtonLongPressTimer.value = null;
  }
};

const handleMuteButtonTouchCancel = () => {
  if (muteButtonLongPressTimer.value) {
    clearTimeout(muteButtonLongPressTimer.value);
    muteButtonLongPressTimer.value = null;
  }
  isMuteButtonLongPressActive.value = false;
};

const handleMuteButtonClick = (event: MouseEvent) => {
  if (isMuteButtonLongPressActive.value) {
    event.preventDefault();
    return;
  }
  const isCtrlOrCmdPressed = isMac ? event.metaKey : event.ctrlKey;

  if (isCtrlOrCmdPressed) {
    emit("toggle-solo", !event.shiftKey);
  } else {
    emit("toggle-muted", !event.shiftKey);
  }
};

watch(
  () => props.isPlaying,
  (newIsPlaying) => {
    if (!waveSurfer.value || !props.isReady) return;
    try {
      if (newIsPlaying) {
        waveSurfer.value?.play();
      } else {
        waveSurfer.value?.pause();
      }
    } catch (error) {
      handleTrackError(error as Error, "playback state change");
    }
  }
);

watch(
  () => isMuted.value,
  () => {
    waveSurfer.value?.setOptions({
      ...waveSurferColorScheme.value
    });
  }
);

watch(
  () => props.volume,
  (newVolume) => {
    if (waveSurfer.value && props.isReady) {
      try {
        const clampedVolume = Math.max(0, Math.min(1, newVolume));
        waveSurfer.value.setVolume(clampedVolume);
        waveSurfer.value.setMuted(clampedVolume === 0);
        // Resync track position after volume change to prevent desynchronization
        // When a track is muted, it pauses; when unmuted, it needs to jump to the current playback position
        try {
          const currentTime = waveSurfer.value.getCurrentTime();
          if (currentTime >= 0 && waveSurfer.value.getDuration() > 0) {
            waveSurfer.value.setTime(currentTime);
          }
        } catch (syncError) {
          handleTrackError(syncError as Error, "resync after volume change");
        }
      } catch (error) {
        handleTrackError(error as Error, "set volume");
      }
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  try {
    if (muteButtonLongPressTimer.value) {
      clearTimeout(muteButtonLongPressTimer.value);
      muteButtonLongPressTimer.value = null;
    }
  } catch (error) {
    handleTrackError(error as Error, "cleanup timer");
  }

  try {
    waveSurfer.value?.destroy();
  } catch (error) {
    handleTrackError(error as Error, "destroy waveSurfer");
  }
});
</script>

<template>
  <div class="relative flex w-full items-stretch gap-2" :style="{ '--color-primary': color }">
    <div
      class="from-primary/12 pointer-events-none absolute inset-x-0 -top-8 -bottom-12 z-0 bg-linear-to-r to-[180px] mask-y-from-50% mask-y-to-100%"
    />
    <div class="z-1 flex w-20 min-w-0 flex-shrink-0 flex-row gap-1 sm:w-24 lg:w-32 xl:w-36">
      <div
        class="flex w-full min-w-0 flex-grow-1 flex-col items-stretch justify-between gap-3 py-2"
      >
        <div class="flex items-center justify-between gap-1.5">
          <span class="text-base-content/70 truncate text-sm text-ellipsis">
            {{ track.title }}
          </span>
          <span v-if="editMode" class="badge badge-sm badge-soft shrink-0 gap-1 px-1">
            <Hash class="size-3" />{{ track.id }}
          </span>
        </div>
        <input
          :value="volume"
          type="range"
          min="0"
          max="1"
          step="0.01"
          class="range range-xs range-primary"
          @input="
            (event: Event) =>
              handleVolumeChange(parseFloat((event.target as HTMLInputElement).value))
          "
        />
      </div>
      <div class="flex flex-shrink-0 flex-grow-0 flex-col items-center justify-center gap-0">
        <button
          v-if="props.hasLyrics"
          :disabled="!isReady"
          class="btn btn-circle btn-sm btn-ghost text-primary flex-shrink-0"
          @click="handleLyricsButtonClick"
        >
          <MicVocal class="h-4 w-4" />
        </button>
        <button
          :disabled="!isReady"
          class="btn btn-circle btn-sm btn-ghost text-primary flex-shrink-0"
          @click="handleMuteButtonClick"
          @touchstart="handleMuteButtonTouchStart"
          @touchend="handleMuteButtonTouchEnd"
          @touchcancel="handleMuteButtonTouchCancel"
        >
          <Volume2Icon v-if="!isMuted" class="h-4 w-4" />
          <VolumeX v-else class="h-4 w-4" />
        </button>
      </div>
    </div>
    <div class="h-2 w-full p-0">
      <WaveSurferPlayer
        :options="waveSurferOptions"
        @wave-surfer="
          (ws: WaveSurfer) => {
            try {
              ws.on('error', (e) => console.error(`WS error (track ${track.id})`, e));
            } catch (_) {
              /* no-op */
            }
            waveSurfer = ws;
          }
        "
        @interaction="(time: number) => emit('seek', time)"
        @ready="(duration: number) => emit('ready', duration)"
        @timeupdate="(time: number) => emit('time-update', time)"
        @finish="emit('finish')"
      />
    </div>
  </div>
</template>
