<script setup lang="ts">
import type { AudioTrack, Collection } from "@/data/types";
import { darken, lighten } from "@/utils/utils";
import { WaveSurferPlayer } from "@meersagor/wavesurfer-vue";
import { Hash, MicVocal, Volume2Icon, VolumeX } from "lucide-vue-next";
import type { PartialWaveSurferOptions } from "node_modules/@meersagor/wavesurfer-vue/dist/types/types";
import { computed, onUnmounted, ref, watch } from "vue";
import type WaveSurfer from "wavesurfer.js";

const props = defineProps<{
  collection: Collection;
  track: AudioTrack;
  volume: number;
  isReady: boolean;
  isPlaying: boolean;
  hasLyrics: boolean;
  lyricsEnabled: boolean;
  editMode?: boolean;
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

// Methods
const seekTo = (time: number) => {
  if (!waveSurfer.value || !props.isReady) return;

  try {
    // Check if waveSurfer is actually ready to accept setTime calls
    if (waveSurfer.value.getDuration() > 0) {
      waveSurfer.value.setTime(time);
    }
  } catch (error) {
    console.warn("Failed to seek track:", error);
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
  return {
    height: 60,
    barGap: 2,
    barWidth: 2,
    barRadius: 8,
    dragToSeek: true,
    backend: "WebAudio",
    url: props.track.audio_file_url,
    ...waveSurferColorScheme.value
  };
});

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
      console.warn("Failed to change playback state:", error);
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
          console.warn("Failed to resync track after volume change:", syncError);
        }
      } catch (error) {
        console.warn("Failed to set volume:", error);
      }
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  if (muteButtonLongPressTimer.value) {
    clearTimeout(muteButtonLongPressTimer.value);
  }
  waveSurfer.value?.destroy();
});
</script>

<template>
  <div class="flex items-stretch gap-2 w-full">
    <div class="w-20 sm:w-24 lg:w-32 xl:w-36 flex flex-row flex-shrink-0 gap-1 min-w-0">
      <div
        class="py-2 gap-3 flex flex-col flex-grow-1 w-full items-stretch justify-between min-w-0"
      >
        <div class="flex items-center gap-1.5 justify-between">
          <span class="text-base-content/70 text-sm truncate text-ellipsis">
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
          :style="{ color }"
          class="range range-xs"
          @input="
            (event: Event) =>
              handleVolumeChange(parseFloat((event.target as HTMLInputElement).value))
          "
        />
      </div>
      <div class="flex flex-col flex-grow-0 flex-shrink-0 gap-0 items-center justify-center">
        <button
          v-if="props.hasLyrics"
          :disabled="!isReady"
          class="btn btn-circle btn-sm btn-ghost flex-shrink-0"
          :style="{ color: props.lyricsEnabled ? trackColor : disabledColor }"
          @click="handleLyricsButtonClick"
        >
          <MicVocal class="w-4 h-4" />
        </button>
        <button
          :disabled="!isReady"
          class="btn btn-circle btn-sm btn-ghost flex-shrink-0"
          :style="{ color }"
          @click="handleMuteButtonClick"
          @touchstart="handleMuteButtonTouchStart"
          @touchend="handleMuteButtonTouchEnd"
          @touchcancel="handleMuteButtonTouchCancel"
        >
          <Volume2Icon v-if="!isMuted" class="w-4 h-4" />
          <VolumeX v-else class="w-4 h-4" />
        </button>
      </div>
    </div>
    <div class="w-full p-0">
      <WaveSurferPlayer
        :options="waveSurferOptions"
        @interaction="(time: number) => emit('seek', time)"
        @wave-surfer="(ws: WaveSurfer) => (waveSurfer = ws)"
        @ready="(duration: number) => emit('ready', duration)"
        @timeupdate="(time: number) => emit('time-update', time)"
        @finish="emit('finish')"
      />
    </div>
  </div>
</template>
