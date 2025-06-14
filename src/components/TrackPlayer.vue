<script setup lang="ts">
import type { Track } from "@/data/song.types";
import { WaveSurferPlayer } from "@meersagor/wavesurfer-vue";
import { MicVocal, Volume2Icon, VolumeX } from "lucide-vue-next";
import type { PartialWaveSurferOptions } from "node_modules/@meersagor/wavesurfer-vue/dist/types/types";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import type WaveSurfer from "wavesurfer.js";

const props = defineProps<{
  track: Track;
  color: string;
  volume: number;
  isReady: boolean;
  isPlaying: boolean;
  hasLyrics: boolean;
  hasLyricsEnabled: boolean;
}>();

const emit = defineEmits<{
  ready: [duration: number];
  "time-update": [time: number];
  finish: [];
  "seek-to-time": [time: number];
  "volume-change": [volume: number];
  "toggle-track-muted": [toggleLyrics: boolean];
  "toggle-track-solo": [toggleLyrics: boolean];
  "toggle-lyrics": [];
}>();

// State
const waveSurfer = ref<WaveSurfer | null>(null);
const isCtrlPressed = ref(false);
const isShiftPressed = ref(false);
const isMuted = computed(() => props.volume === 0);
const muteButtonLongPressTimer = ref<number | null>(null);
const isMuteButtonLongPressActive = ref(false);
const TOUCH_DURATION = 500; // 500ms for long press
const isMac = navigator.userAgent.indexOf("Mac") > 0;

// Methods
const seekTo = (time: number) => {
  if (!waveSurfer.value || !props.isReady) return;
  waveSurfer.value.setTime(time);
};

const handleVolumeChange = (value: number | number[]) => {
  const newVolume = Array.isArray(value) ? value[0] : value;
  const clampedVolume = Math.max(0, Math.min(1, newVolume));
  if (waveSurfer.value) {
    waveSurfer.value.setVolume(clampedVolume);
  }
  emit("volume-change", clampedVolume);
};

defineExpose({
  seekTo
});

const waveSurferColorScheme = computed(() => {
  const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const color = isMuted.value ? "zinc" : props.color;

  const rootStyle = getComputedStyle(document.documentElement);
  const waveColorValue = rootStyle
    .getPropertyValue(`--color-${color}-${isDarkMode ? "600" : "400"}`)
    .trim();
  const progressColorValue = rootStyle
    .getPropertyValue(`--color-${color}-${isDarkMode ? "500" : "600"}`)
    .trim();

  return {
    waveColor: waveColorValue || `var(--color-${color}-600)`,
    progressColor: progressColorValue || `var(--color-${color}-500)`
  };
});

// WaveSurfer Configuration
const waveSurferOptions = computed<PartialWaveSurferOptions>(() => {
  return {
    height: 60,
    barGap: 2,
    barWidth: 2,
    barRadius: 8,
    dragToSeek: true,
    backend: "WebAudio",
    url: props.track.file,
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
    emit("toggle-track-solo", !isShiftPressed.value);
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
  // Prevent click handler from firing if it was a long press
  if (isMuteButtonLongPressActive.value) {
    event.preventDefault();
    return;
  }

  if (isCtrlPressed.value) {
    emit("toggle-track-solo", !isShiftPressed.value);
  } else {
    emit("toggle-track-muted", !isShiftPressed.value);
  }
};

const handleKeydown = (event: KeyboardEvent) => {
  if ((isMac && event.key === "Meta") || (!isMac && event.key === "Control")) {
    isCtrlPressed.value = true;
  }
  if (event.key === "Shift") {
    isShiftPressed.value = true;
  }
};

const handleKeyup = (event: KeyboardEvent) => {
  if ((isMac && event.key === "Meta") || (!isMac && event.key === "Control")) {
    isCtrlPressed.value = false;
  }
  if (event.key === "Shift") {
    isShiftPressed.value = false;
  }
};

watch(
  () => props.isPlaying,
  (newIsPlaying) => {
    if (!waveSurfer.value || !props.isReady) return;
    if (newIsPlaying) {
      waveSurfer.value?.play();
    } else {
      waveSurfer.value?.pause();
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
    if (waveSurfer.value) {
      const clampedVolume = Math.max(0, Math.min(1, newVolume));
      waveSurfer.value.setVolume(clampedVolume);
      waveSurfer.value.setMuted(clampedVolume === 0);
      // Hack to prevent the track from desynchronizing
      const currentTime = waveSurfer.value.getCurrentTime();
      waveSurfer.value.setTime(currentTime);
    }
  },
  { immediate: true }
);

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("keyup", handleKeyup);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
  window.removeEventListener("keyup", handleKeyup);
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
        <span class="text-base-content/70 text-sm truncate text-ellipsis">
          {{ track.title }}
        </span>
        <input
          :value="volume"
          type="range"
          min="0"
          max="1"
          step="0.01"
          :class="`range range-xs text-${isMuted ? 'zinc' : props.color}-500`"
          @input="
            (event) => handleVolumeChange(parseFloat((event.target as HTMLInputElement).value))
          "
        />
      </div>
      <div class="flex flex-col flex-grow-0 flex-shrink-0 gap-0 items-center justify-center">
        <button
          v-if="hasLyrics"
          :disabled="!isReady"
          @click="handleLyricsButtonClick"
          :class="`btn btn-circle btn-sm btn-ghost text-${!hasLyricsEnabled ? 'zinc-500' : `${color}-500`} flex-shrink-0`"
        >
          <MicVocal class="w-4 h-4" />
        </button>
        <button
          :disabled="!isReady"
          @click="handleMuteButtonClick"
          @touchstart="handleMuteButtonTouchStart"
          @touchend="handleMuteButtonTouchEnd"
          @touchcancel="handleMuteButtonTouchCancel"
          :class="`btn btn-circle btn-sm btn-ghost text-${isMuted ? 'zinc-500' : `${color}-500`} flex-shrink-0`"
        >
          <Volume2Icon class="w-4 h-4" v-if="!isMuted" />
          <VolumeX class="w-4 h-4" v-else />
        </button>
      </div>
    </div>
    <div class="w-full p-0">
      <WaveSurferPlayer
        :options="waveSurferOptions"
        @interaction="(time: number) => emit('seek-to-time', time)"
        @waveSurfer="(ws: WaveSurfer) => (waveSurfer = ws)"
        @ready="(duration: number) => emit('ready', duration)"
        @timeupdate="(time: number) => emit('time-update', time)"
        @finish="emit('finish')"
      />
    </div>
  </div>
</template>
