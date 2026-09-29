<script setup lang="ts">
import { WaveSurferPlayer } from "@meersagor/wavesurfer-vue";
import { computed, onUnmounted, ref, toRef, watch } from "vue";
import type WaveSurfer from "wavesurfer.js";
import type { WaveSurferOptions } from "wavesurfer.js";

import { IconHash, IconLyrics, IconRetry, IconWarning } from "@/components/ui/icons";
import { useCollectionPalette } from "@/composables/useCollectionPalette";
import { useLongPress } from "@/composables/useLongPress";
import { audioPlaybackUrl } from "@/data/storage";
import type { AudioTrack, CollectionWithRole } from "@/data/types";
import { type ColorSpec, deriveColor } from "@/utils/palette";
import { isIOS } from "@/utils/platform";
import { cleanupWaveSurfer } from "@/utils/wavesurfer-cleanup";

const props = defineProps<{
  collection: CollectionWithRole;
  track: AudioTrack;
  /** Slider position. */
  volume: number;
  /** What the track actually sounds at (volume, mute, solo, Mi parte). */
  gain: number;
  muted: boolean;
  soloed: boolean;
  failed: boolean;
  isReady: boolean;
  isPlaying: boolean;
  hasLyrics: boolean;
  lyricsEnabled: boolean;
  editMode?: boolean;
  audioContext?: AudioContext;
  deferLoad?: boolean;
  /** 1–9: the digit shortcut for this track. */
  position?: number;
}>();

const emit = defineEmits<{
  ready: [duration: number];
  "time-update": [time: number];
  finish: [];
  error: [];
  retry: [];
  seek: [time: number];
  "volume-change": [volume: number];
  "toggle-muted": [toggleLyrics: boolean];
  "toggle-solo": [toggleLyrics: boolean];
  "toggle-lyrics": [];
  "solo-lyrics": [];
}>();

// State
const waveSurfer = ref<WaveSurfer | null>(null);
const hasBegunLoad = ref(false);
const currentUrl = ref<string | null>(null);
if (!props.deferLoad) {
  currentUrl.value = audioPlaybackUrl(props.track);
}

// M: tap mutes (Shift also hides the lyrics, as before); long press or ⌘+click solos.
const muteButton = useLongPress({
  tap: (shift) => emit("toggle-muted", shift),
  longPress: () => emit("toggle-solo", false)
});
// Lyrics: tap shows/hides; long press or ⌘+click shows only this track's lyrics.
const lyricsButton = useLongPress({
  tap: () => emit("toggle-lyrics"),
  longPress: () => emit("solo-lyrics")
});

const isSilent = computed(() => props.gain === 0);

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

const onVolumeInput = (event: Event) => {
  const value = parseFloat((event.target as HTMLInputElement).value);
  emit("volume-change", Math.max(0, Math.min(1, value)));
};

const load = () => {
  const url = audioPlaybackUrl(props.track);
  currentUrl.value = url;
  // WaveSurferPlayer doesn't watch for option changes, so we must call load() explicitly
  waveSurfer.value?.load(url)?.catch(() => emit("error"));
};

// WaveSurfer 7 emits a stray timeupdate(0) right after pause() (its media position
// is still right), which sent the player clock back to 0:00. Read the position
// instead of trusting the event value.
const onTimeUpdate = (time: number) => {
  emit("time-update", waveSurfer.value?.getCurrentTime() ?? time);
};

defineExpose({
  waveSurfer,
  seekTo,
  beginLoad: () => {
    if (hasBegunLoad.value) return;
    hasBegunLoad.value = true;
    load();
  },
  retry: () => {
    hasBegunLoad.value = true;
    load();
  }
});

// Colors come from the collection palette (hue + intensity), per theme. A silent
// track turns neutral; its unplayed wave is the same color at low alpha.
const { trackSpec, resolvedTheme } = useCollectionPalette(toRef(props, "collection"));
const NEUTRAL: ColorSpec = { neutral: true };
const ownSpec = computed(() => trackSpec(props.track.color_key));
const spec = computed(() => (isSilent.value || props.failed ? NEUTRAL : ownSpec.value));
const ink = computed(() => deriveColor(ownSpec.value, "lyric", resolvedTheme.value));
const dotColor = computed(() => deriveColor(spec.value, "wave", resolvedTheme.value));
const glowColor = computed(() => deriveColor(spec.value, "fill", resolvedTheme.value, 0.12));
const soloBackground = computed(() => deriveColor(ownSpec.value, "fill", resolvedTheme.value, 0.22));

const waveSurferColorScheme = computed(() => ({
  waveColor: deriveColor(spec.value, "wave", resolvedTheme.value, 0.3),
  progressColor: deriveColor(spec.value, "wave", resolvedTheme.value)
}));

const waveSurferOptions = computed<Partial<Omit<WaveSurferOptions, "container">>>(() => ({
  height: 34,
  barHeight: 0.92,
  barGap: isIOS ? 1.5 : 2,
  barWidth: isIOS ? 2 : 3,
  barRadius: 8,
  cursorWidth: 0,
  dragToSeek: !isIOS,
  backend: "WebAudio" as const,
  url: currentUrl.value ?? undefined,
  audioContext: props.audioContext,
  peaks: props.track.peaks?.channels,
  ...waveSurferColorScheme.value
}));

watch(
  () => props.isPlaying,
  (newIsPlaying) => {
    if (!waveSurfer.value || !props.isReady) return;
    try {
      if (newIsPlaying) {
        waveSurfer.value?.play()?.catch(() => {});
      } else {
        waveSurfer.value?.pause();
      }
    } catch (error) {
      handleTrackError(error as Error, "playback state change");
    }
  }
);

// Mute and theme changes repaint the wave.
watch(waveSurferColorScheme, (scheme) => {
  waveSurfer.value?.setOptions({ ...scheme });
});

// The applied gain is what reaches the speakers.
watch(
  [() => props.gain, () => props.isReady],
  ([gain, isReady]) => {
    if (!waveSurfer.value || !isReady) return;
    try {
      waveSurfer.value.setVolume(gain);
      waveSurfer.value.setMuted(gain === 0);
      // WaveSurfer may pause a muted track; resume it when it becomes audible
      if (gain > 0 && props.isPlaying) {
        waveSurfer.value.play()?.catch(() => {});
      }
    } catch (error) {
      handleTrackError(error as Error, "set gain");
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  const ws = waveSurfer.value;
  waveSurfer.value = null;
  void cleanupWaveSurfer(ws).catch((error: unknown) => {
    handleTrackError(error as Error, "destroy waveSurfer");
  });
});

const buttonBase =
  "grid h-[22px] w-[26px] place-items-center rounded-[7px] font-mono text-[10.5px] font-bold transition-colors disabled:opacity-40 max-md:h-[30px] max-md:w-[34px] max-md:rounded-[9px] max-md:text-xs";
const buttonIdle = "bg-base-content/6 text-base-content/60 hover:bg-base-content/12";
</script>

<template>
  <div
    class="relative grid w-full grid-cols-1 items-center gap-x-4 max-md:border-base-content/10 max-md:border-t max-md:py-2.5 md:h-[46px] md:grid-cols-[198px_minmax(0,1fr)]"
    :data-testid="`track-${track.title}`"
    :data-muted="muted || undefined"
    :data-soloed="soloed || undefined"
    :data-silent="isSilent || undefined"
    :data-failed="failed || undefined"
  >
    <div
      class="pointer-events-none absolute inset-y-0 -left-3.5 hidden w-[260px] rounded-l-xl md:block"
      :style="{ background: `linear-gradient(90deg, ${glowColor}, transparent)` }"
    />

    <div class="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1.5">
      <span class="flex min-w-0 items-center gap-2 text-[13.5px] leading-none font-semibold max-md:text-sm">
        <span
          class="size-2.5 shrink-0 rounded-full"
          :style="{ background: dotColor, boxShadow: `0 0 10px ${dotColor}` }"
        />
        <span class="truncate" :class="{ 'text-base-content/50': isSilent || failed }">{{
          track.title
        }}</span>
        <span v-if="editMode" class="badge badge-xs badge-soft shrink-0 gap-0.5 px-1">
          <IconHash class="size-2.5" />{{ track.id }}
        </span>
      </span>

      <span v-if="!failed" class="flex gap-[3px] max-md:gap-1.5">
        <button
          :disabled="!isReady"
          :class="[buttonBase, muted ? 'bg-error/15 text-error' : buttonIdle]"
          :aria-pressed="muted"
          :aria-label="`Silenciar ${track.title}`"
          :title="`Silenciar${position ? ` (${position})` : ''} · ⌘+clic: solo`"
          data-testid="mute-button"
          v-on="muteButton"
        >
          M
        </button>
        <button
          :disabled="!isReady"
          :class="[buttonBase, soloed ? '' : buttonIdle]"
          :style="soloed ? { background: soloBackground, color: ink } : undefined"
          :aria-pressed="soloed"
          :aria-label="`Solo de ${track.title}`"
          :title="`Solo${position ? ` (⌥${position})` : ''}`"
          data-testid="solo-button"
          @click="emit('toggle-solo', false)"
        >
          S
        </button>
        <button
          v-if="hasLyrics"
          :disabled="!isReady"
          :class="[buttonBase, 'bg-base-content/6 hover:bg-base-content/12']"
          :style="{ color: lyricsEnabled ? ink : undefined }"
          :aria-pressed="lyricsEnabled"
          :aria-label="`Letra de ${track.title}`"
          title="Mostrar u ocultar la letra · ⌘+clic: solo esta letra"
          data-testid="lyrics-button"
          v-on="lyricsButton"
        >
          <IconLyrics class="size-3.5 max-md:size-[17px]" />
        </button>
      </span>
      <button
        v-else
        class="btn btn-xs btn-ghost text-error gap-1"
        data-testid="retry-button"
        @click="emit('retry')"
      >
        <IconRetry class="size-3.5" />
        Reintentar
      </button>

      <input
        v-if="!failed"
        :value="volume"
        type="range"
        min="0"
        max="1"
        step="0.01"
        :aria-label="`Volumen de ${track.title}`"
        class="track-volume col-span-2"
        :style="{ '--fill': `${volume * 100}%`, '--track-color': dotColor }"
        @input="onVolumeInput"
        @dblclick="emit('volume-change', 1)"
      />
    </div>

    <div
      class="relative min-w-0 max-md:pointer-events-none max-md:invisible max-md:absolute max-md:h-0 max-md:overflow-hidden"
      :class="{ 'opacity-40': isSilent && !failed }"
    >
      <div
        v-if="failed"
        class="text-error flex h-[34px] items-center gap-2 text-xs font-medium"
      >
        <IconWarning class="size-4" />
        No se pudo cargar el audio de esta pista.
      </div>
      <div :class="{ hidden: failed }">
        <WaveSurferPlayer
          :options="waveSurferOptions"
          @wave-surfer="
            (ws: WaveSurfer) => {
              waveSurfer = ws;
              ws.on('error', () => emit('error'));
            }
          "
          @interaction="(time: number) => emit('seek', time)"
          @ready="(duration: number) => emit('ready', duration)"
          @timeupdate="onTimeUpdate"
          @finish="emit('finish')"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Thin volume slider in the track's color (a native range; DaisyUI's is too heavy here). */
.track-volume {
  appearance: none;
  height: 16px;
  background: transparent;
  cursor: pointer;
}
.track-volume::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(
    90deg,
    var(--track-color) var(--fill),
    color-mix(in oklch, var(--color-base-content) 10%, transparent) var(--fill)
  );
}
.track-volume::-moz-range-track {
  height: 4px;
  border-radius: 2px;
  background: color-mix(in oklch, var(--color-base-content) 10%, transparent);
}
.track-volume::-moz-range-progress {
  height: 4px;
  border-radius: 2px;
  background: var(--track-color);
}
.track-volume::-webkit-slider-thumb {
  appearance: none;
  width: 12px;
  height: 12px;
  margin-top: -4px;
  border-radius: 50%;
  background: var(--color-base-100);
  box-shadow:
    0 0 0 1px var(--glass-edge),
    0 1px 3px oklch(0% 0 0 / 0.3);
}
.track-volume::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border: 0;
  border-radius: 50%;
  background: var(--color-base-100);
  box-shadow:
    0 0 0 1px var(--glass-edge),
    0 1px 3px oklch(0% 0 0 / 0.3);
}
@media (max-width: 767px) {
  .track-volume {
    height: 22px;
  }
  .track-volume::-webkit-slider-runnable-track {
    height: 5px;
  }
  .track-volume::-webkit-slider-thumb {
    width: 18px;
    height: 18px;
    margin-top: -6.5px;
  }
}
</style>
