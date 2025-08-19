<script setup lang="ts">
import { ChevronDown, Loader2, MicVocal } from "lucide-vue-next";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";

import SongEditor from "@/components/editor/SongEditor.vue";
import TimeCopier from "@/components/editor/TimeCopier.vue";
import LyricsViewer from "@/components/lyrics/LyricsViewer.vue";
import PlayerControls from "@/components/player/PlayerControls.vue";
import PlayerHeader from "@/components/player/PlayerHeader.vue";
import TrackPlayer from "@/components/player/TrackPlayer.vue";
import { providePlayerState } from "@/composables/useCurrentTime";
import { useMediaSession } from "@/composables/useMediaSession";
import type { CollectionWithRole, LyricStanza, Song } from "@/data/types";
import { useUIStore } from "@/stores/ui";

const props = defineProps<{
  collection: CollectionWithRole;
  song: Song;
  lyrics: LyricStanza[];
}>();

const uiStore = useUIStore();

// General state
const sortedTracks = computed(() => {
  return [...props.song.audio_tracks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
});

const tracksIdsWithLyrics = () => {
  const tracks = new Set<number>();
  props.song.lyrics?.forEach((stanza) => {
    stanza.forEach((item) => {
      if (Array.isArray(item)) {
        item.forEach((column) => {
          column.forEach((verse) => {
            verse.audio_track_ids?.forEach((trackId) => tracks.add(trackId));
          });
        });
      } else {
        item.audio_track_ids?.forEach((trackId) => tracks.add(trackId));
      }
    });
  });
  return Array.from(tracks);
};

const state = {
  currentTime: ref<number>(0),
  lastSeekTime: ref<number>(0),
  totalDuration: ref<number>(0),
  playing: ref(false),
  trackStates: ref(
    sortedTracks.value.map((track) => ({
      id: track.id,
      isReady: false,
      volume: 1,
      hasLyrics: tracksIdsWithLyrics().includes(track.id),
      lyricsEnabled: true
    }))
  )
};
const isReady = computed(() => state.trackStates.value.every((track) => track.isReady));
const trackIdsWithLyricsEnabled = computed(() => {
  return state.trackStates.value.filter((track) => track.lyricsEnabled).map((track) => track.id);
});

// Platform detection
const isIOS = computed(
  () =>
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1)
);

// Sequential initialization on iOS to avoid concurrent decodes
const initializedTrackCount = ref<number>(0);
watch(
  () => props.song,
  () => {
    initializedTrackCount.value = isIOS.value ? 1 : sortedTracks.value.length;
  },
  { immediate: true }
);
const displayedTracks = computed(() => {
  return isIOS.value
    ? sortedTracks.value.slice(0, initializedTrackCount.value)
    : sortedTracks.value;
});

providePlayerState({
  currentTime: state.currentTime,
  totalDuration: state.totalDuration,
  isPlaying: state.playing,
  isReady
});
// Cleanup and reset when switching songs to prevent lingering decoders/buffers
watch(
  () => props.song.id,
  () => {
    try {
      trackPlayers.value.forEach((player, index) => {
        try {
          player?.waveSurfer?.destroy();
        } catch (error) {
          handleAudioError(error as Error, `destroy wavesurfer on song change ${index}`);
        }
      });
      trackPlayers.value = [] as any;
    } catch (error) {
      handleAudioError(error as Error, "reset track players on song change");
    }

    // Reset state for new song
    state.currentTime.value = 0;
    state.totalDuration.value = 0;
    state.playing.value = false;
    state.trackStates.value = sortedTracks.value.map((track) => ({
      id: track.id,
      isReady: false,
      volume: 1,
      hasLyrics: tracksIdsWithLyrics().includes(track.id),
      lyricsEnabled: true
    }));

    // Reset iOS sequential init counter
    initializedTrackCount.value = isIOS.value ? 1 : sortedTracks.value.length;
  }
);

// Interactivity
const seekAllTracks = (time: number) => {
  trackPlayers.value.forEach((player, index) => {
    if (player) {
      try {
        player.seekTo(time);
      } catch (error) {
        handleAudioError(error as Error, `seek track ${index}`);
      }
    }
  });
  state.currentTime.value = time;
};

const onReady = (trackIndex: number, duration: number) => {
  state.trackStates.value[trackIndex]!.isReady = true;
  if (trackIndex === 0) {
    state.totalDuration.value = duration;
  }
  // Progressively initialize next track on iOS once current one is ready
  if (isIOS.value && initializedTrackCount.value < sortedTracks.value.length) {
    initializedTrackCount.value += 1;
  }
};

const onTimeUpdate = (trackIndex: number, time: number) => {
  if (trackIndex === 0) {
    state.currentTime.value = time;
  }
};

const onFinish = (trackIndex: number) => {
  // Stop playback when any audible track finishes
  // (all tracks should finish at the same time, so we can stop on any finish event)
  const trackVolume = state.trackStates.value[trackIndex]?.volume ?? 0;
  if (trackVolume > 0) {
    state.playing.value = false;
  }
};

const onVolumeChange = (trackIndex: number, volume: number) => {
  const clampedVolume = Math.max(0, Math.min(1, volume));
  state.trackStates.value[trackIndex]!.volume = clampedVolume;
  if (state.trackStates.value[trackIndex]!.volume > 0) {
    onSetTrackLyricsEnabled(sortedTracks.value[trackIndex]!.id, true);
  } else {
    onSetTrackLyricsEnabled(sortedTracks.value[trackIndex]!.id, false);
  }
};

const onToggleTrackMuted = (trackIndex: number, toggleLyrics: boolean) => {
  const shouldBeEnabled = state.trackStates.value[trackIndex]!.volume === 0;
  const newVolume = shouldBeEnabled ? 1 : 0;
  onVolumeChange(trackIndex, newVolume);
  if (toggleLyrics) {
    onSetTrackLyricsEnabled(sortedTracks.value[trackIndex]!.id, shouldBeEnabled);
  }
};

const onSoloTrack = (index: number, toggleLyrics: boolean) => {
  const isCurrentlySoloed = state.trackStates.value.every(
    (track, i) => i === index || track.volume === 0
  );

  state.trackStates.value.forEach((_, i) => {
    const shouldBeEnabled = i === index || isCurrentlySoloed;
    const newVolume = shouldBeEnabled ? 1 : 0;
    onVolumeChange(i, newVolume);
    if (toggleLyrics) {
      onSetTrackLyricsEnabled(sortedTracks.value[i]!.id, shouldBeEnabled);
    }
  });
};

const onSetTrackLyricsEnabled = (trackId: number, newState: boolean) => {
  const trackIndex = sortedTracks.value.findIndex((track) => track.id === trackId);
  if (trackIndex === -1) return;
  state.trackStates.value[trackIndex]!.lyricsEnabled = newState;
};

const onToggleTrackLyrics = (trackId: number) => {
  const trackIndex = sortedTracks.value.findIndex((track) => track.id === trackId);
  if (trackIndex === -1) return;
  onSetTrackLyricsEnabled(trackId, !state.trackStates.value[trackIndex]!.lyricsEnabled);
};

const onPlayPause = async (forcePlay?: boolean) => {
  // Check if tracks are ready before allowing playback
  if (!isReady.value && (forcePlay === true || forcePlay === undefined)) {
    handleAudioError(new Error("Cannot start playback: tracks are not ready"), "onPlayPause");
    return;
  }

  // If AudioContext exists but is suspended, try to resume it within user gesture
  if (audioContext.value?.state === "suspended") {
    try {
      await audioContext.value.resume();
    } catch (resumeError) {
      handleAudioError(resumeError as Error, "audioContext.resume");
      return;
    }
  }

  // Initialize audio context for WebAudio API user gesture requirement
  if (!hasInitializedAudio.value) {
    try {
      await initializeAudioContext();
      // Try to play silent audio to unlock WebAudio context
      if (silentAudio.value) {
        try {
          await silentAudio.value.play();
        } catch (playError) {
          console.debug("Silent audio play was blocked or failed:", playError);
        }
      }
    } catch (e) {
      handleAudioError(e as Error, "initializeAudioContext in onPlayPause");
      return; // Don't proceed if audio context initialization fails
    }
  }

  try {
    state.playing.value = forcePlay ?? !state.playing.value;
  } catch (error) {
    handleAudioError(error as Error, "setting playing state");
  }
};

const onSeekToTime = (time: number) => {
  seekAllTracks(time);
};

const keydownHandler = (event: KeyboardEvent) => {
  // Check if the event originates from an capturing element
  const target = event.target as HTMLElement;
  const isInCapturingElement =
    target &&
    (target.closest(".jse-modal") || target.closest("input") || target.closest("textarea")) &&
    !event.ctrlKey;

  if (event.key === " " && (!isInCapturingElement || event.ctrlKey)) {
    event.preventDefault();
    onPlayPause();
  } else if (event.key === "ArrowLeft" && (!isInCapturingElement || event.altKey)) {
    event.preventDefault();
    const newTime = Math.max(0, state.currentTime.value - 0.1);
    onSeekToTime(newTime);
  } else if (event.key === "ArrowRight" && (!isInCapturingElement || event.altKey)) {
    event.preventDefault();
    const newTime = Math.min(state.totalDuration.value, state.currentTime.value + 0.1);
    onSeekToTime(newTime);
  }
};

onMounted(() => {
  window.addEventListener("keydown", keydownHandler);
  initMediaSession();
});

onUnmounted(() => {
  try {
    window.removeEventListener("keydown", keydownHandler);
  } catch (error) {
    handleAudioError(error as Error, "removeEventListener");
  }

  try {
    stopSyncCheck();
  } catch (error) {
    handleAudioError(error as Error, "stopSyncCheck");
  }

  // More aggressive cleanup of track players
  trackPlayers.value.forEach((player, index) => {
    try {
      player?.waveSurfer?.destroy();
    } catch (error) {
      handleAudioError(error as Error, `destroying wavesurfer ${index}`);
    }
  });

  try {
    cleanupMediaSession();
  } catch (error) {
    handleAudioError(error as Error, "cleanupMediaSession");
  }

  try {
    cleanupAudioInterruptionListeners();
  } catch (error) {
    handleAudioError(error as Error, "cleanupAudioInterruptionListeners");
  }

  // Clean up audio context reference
  audioContext.value = null;

  if (silentAudio.value) {
    try {
      silentAudio.value.pause();
      silentAudio.value.src = "";
      silentAudio.value.load();
      silentAudio.value = null;
    } catch (error) {
      handleAudioError(error as Error, "silentAudio cleanup");
      silentAudio.value = null; // Force cleanup even if error
    }
  }
});

// UI/Visual related state
const tracksVisible = ref(true);

// PWA detection
const isPWA = computed(() => {
  return window.matchMedia("(display-mode: standalone)").matches;
});

// Audio playing trickery
const trackPlayers = ref<InstanceType<typeof TrackPlayer>[]>([]);
const syncInterval = ref<number | null>(null);
const SYNC_CHECK_INTERVAL = 1000;
const DRIFT_THRESHOLD = 0.05;
const hasInitializedAudio = ref(false);
const silentAudio = ref<HTMLAudioElement | null>(null);
const audioContext = ref<AudioContext | null>(null);
const audioStateChangeHandlerRef = ref<((this: AudioContext, ev: Event) => any) | null>(null);
const visibilityChangeHandlerRef = ref<((this: Document, ev: Event) => any) | null>(null);

const checkAndCorrectSync = () => {
  if (!state.playing.value || !isReady.value) return;

  const referenceTrack = trackPlayers.value[0];
  if (!referenceTrack?.waveSurfer) return;

  try {
    const referenceTime = referenceTrack.waveSurfer.getCurrentTime?.() ?? 0;

    // Only proceed if we have a valid reference time (not 0 unless actually at start)
    if (referenceTime < 0) return;

    trackPlayers.value.forEach((player, index) => {
      if (!player?.waveSurfer || index === 0) return; // Skip reference track

      try {
        const time = player.waveSurfer.getCurrentTime?.() ?? 0;
        const drift = time - referenceTime;
        if (Math.abs(drift) > DRIFT_THRESHOLD) {
          player.seekTo(referenceTime);
        }
      } catch (error) {
        handleAudioError(error as Error, `sync track ${index}`);
      }
    });

    state.currentTime.value = referenceTime;
  } catch (error) {
    handleAudioError(error as Error, "checkAndCorrectSync");
  }
};

const startSyncCheck = () => {
  try {
    stopSyncCheck();
    syncInterval.value = window.setInterval(checkAndCorrectSync, SYNC_CHECK_INTERVAL);
  } catch (error) {
    handleAudioError(error as Error, "startSyncCheck");
  }
};

const stopSyncCheck = () => {
  try {
    if (syncInterval.value) {
      window.clearInterval(syncInterval.value);
      syncInterval.value = null;
    }
  } catch (error) {
    handleAudioError(error as Error, "stopSyncCheck");
  }
};

watch(
  () => state.playing.value,
  (isPlaying) => {
    if (isPlaying) {
      startSyncCheck();
    } else {
      stopSyncCheck();
    }
  }
);

watch(
  () => isReady.value,
  (ready) => {
    if (ready) {
      // If we already created a shared AudioContext, set up listeners now
      if (audioContext.value) {
        setupAudioInterruptionListeners();
        return;
      }

      // Fallback: derive context from first wavesurfer instance if we didn't create one
      const firstTrack = trackPlayers.value[0];
      if (firstTrack?.waveSurfer) {
        const ws = firstTrack.waveSurfer as any;
        if (ws.backend?.audioContext) {
          audioContext.value = ws.backend.audioContext;
          setupAudioInterruptionListeners();
        }
      }
    }
  }
);

// MediaSession
const mediaSessionOptions = computed(() => ({
  title: props.song.title,
  artist: "",
  album: props.collection.title,
  artwork: props.collection.artwork_file_url || "",
  duration: state.totalDuration.value
}));

const {
  currentTime: mediaSessionTime,
  isPlaying: mediaSessionPlaying,
  initMediaSession,
  cleanupMediaSession
} = useMediaSession(mediaSessionOptions, {
  onPlay: () => onPlayPause(true),
  onPause: () => onPlayPause(false),
  onSeek: (time) => onSeekToTime(time)
});

const isUpdatingFromMediaSession = ref(false);

watch(mediaSessionPlaying, (playing) => {
  if (isUpdatingFromMediaSession.value) return;

  if (playing !== state.playing.value) {
    state.playing.value = playing;
  }
});

watch(mediaSessionTime, (time) => {
  if (isUpdatingFromMediaSession.value) return;

  if (Math.abs(time - state.currentTime.value) > 0.1) {
    seekAllTracks(time);
  }
});

// Update MediaSession state without triggering circular updates
watch(
  () => state.playing.value,
  (playing) => {
    isUpdatingFromMediaSession.value = true;
    mediaSessionPlaying.value = playing;
    // Use nextTick to ensure the flag is reset after all watchers have run
    nextTick(() => {
      isUpdatingFromMediaSession.value = false;
    });
  }
);

watch(
  () => state.currentTime.value,
  (time) => {
    isUpdatingFromMediaSession.value = true;
    mediaSessionTime.value = time;
    nextTick(() => {
      isUpdatingFromMediaSession.value = false;
    });
  }
);

const handleAudioError = (error: Error, context: string) => {
  console.error(`Audio error in ${context}:`, error);
  // Don't throw, just log to prevent crashes
};

const handleAudioInterruption = () => {
  if (state.playing.value) {
    state.playing.value = false;
  }
};

const setupAudioInterruptionListeners = () => {
  try {
    // iOS suspends audio context during screen lock, causing stuck playback state
    if (audioContext.value && !audioStateChangeHandlerRef.value) {
      audioStateChangeHandlerRef.value = () => {
        if (audioContext.value?.state === "suspended") {
          handleAudioInterruption();
        }
      };
      audioContext.value.addEventListener("statechange", audioStateChangeHandlerRef.value);
    }

    // Mobile browsers don't always trigger audio context suspension on screen lock
    if (!visibilityChangeHandlerRef.value) {
      visibilityChangeHandlerRef.value = () => {
        if (document.hidden) {
          handleAudioInterruption();
        }
      };
      document.addEventListener("visibilitychange", visibilityChangeHandlerRef.value);
    }
  } catch (error) {
    handleAudioError(error as Error, "setupAudioInterruptionListeners");
  }
};

const cleanupAudioInterruptionListeners = () => {
  try {
    if (audioContext.value && audioStateChangeHandlerRef.value) {
      audioContext.value.removeEventListener("statechange", audioStateChangeHandlerRef.value);
      audioStateChangeHandlerRef.value = null;
    }
    if (visibilityChangeHandlerRef.value) {
      document.removeEventListener("visibilitychange", visibilityChangeHandlerRef.value);
      visibilityChangeHandlerRef.value = null;
    }
  } catch (error) {
    handleAudioError(error as Error, "cleanupAudioInterruptionListeners");
  }
};

const initializeAudioContext = async () => {
  // Only run once
  if (hasInitializedAudio.value) {
    return Promise.resolve();
  }

  try {
    // Create (or reuse) a single shared AudioContext for all WaveSurfer instances
    if (!audioContext.value) {
      const AudioContextCtor: typeof AudioContext | undefined =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioContextCtor) {
        // Prefer 44.1 kHz and playback latency for lower memory/CPU on iOS
        try {
          audioContext.value = new AudioContextCtor({
            sampleRate: 44100,
            latencyHint: "playback" as any
          });
        } catch {
          audioContext.value = new AudioContextCtor();
        }
      }
    }

    // Create silent audio element to unlock audio context on user interaction
    // This is needed for WebAudio API which requires user gesture to start playing
    silentAudio.value = new Audio();
    // Use a very short mp3 data URI
    silentAudio.value.src =
      "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAAwAAAQABAQEBAQEBAQEBAQEBAQEBAQEB";

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        handleAudioError(new Error("Audio load timeout"), "initializeAudioContext");
        reject(new Error("Audio load timeout"));
      }, 5000);

      const cleanup = () => {
        clearTimeout(timeout);
      };

      silentAudio.value!.addEventListener(
        "canplaythrough",
        () => {
          cleanup();
          resolve(void 0);
        },
        { once: true }
      );

      silentAudio.value!.addEventListener(
        "error",
        (e) => {
          cleanup();
          handleAudioError(new Error(e.message || "Silent audio error"), "silentAudio");
          reject(e);
        },
        { once: true }
      );

      try {
        silentAudio.value!.load();
      } catch (loadError) {
        cleanup();
        handleAudioError(loadError as Error, "silentAudio.load");
        reject(loadError);
      }
    });

    hasInitializedAudio.value = true;
  } catch (error) {
    handleAudioError(error as Error, "initializeAudioContext");
    // Set as initialized anyway to prevent repeated attempts
    hasInitializedAudio.value = true;
  }
};
</script>

<template>
  <div class="drawer drawer-end" :class="{ 'lg:drawer-open': uiStore.editMode }">
    <input
      id="song-editor-drawer"
      type="checkbox"
      class="drawer-toggle"
      :checked="uiStore.editMode"
      @change="uiStore.setEditMode(($event.target as HTMLInputElement).checked)"
    />

    <div class="drawer-content">
      <div
        class="bg-base-200 flex h-dvh min-w-0 flex-col overflow-hidden select-none md:gap-3 md:p-3 lg:gap-4 lg:p-4"
      >
        <div class="relative flex items-center justify-between gap-3 p-3 md:p-0 md:pb-3">
          <PlayerHeader
            :collection="collection"
            :song="song"
            @toggle-edit="uiStore.toggleEditMode"
          />
          <PlayerControls
            :current-time="state.currentTime.value"
            :total-duration="state.totalDuration.value"
            :is-playing="state.playing.value"
            :is-ready="isReady"
            :edit-mode="uiStore.editMode"
            @play-pause="onPlayPause"
          />
          <div class="absolute top-2 left-1/2 flex -translate-x-1/2 items-center justify-end">
            <TimeCopier :current-time="state.currentTime.value" />
          </div>
        </div>

        <div v-if="lyrics.length > 0" class="relative flex-grow-1 snap-y overflow-auto">
          <div class="from-base-200/80 sticky inset-0 h-[32px] bg-gradient-to-b to-transparent" />
          <LyricsViewer
            :lyrics="lyrics"
            :current-time="state.currentTime.value"
            :is-disabled="!isReady"
            :collection="collection"
            :enabled-track-ids="trackIdsWithLyricsEnabled"
            @seek="onSeekToTime"
          />
          <div class="to-base-200/80 sticky inset-0 h-[32px] bg-gradient-to-b from-transparent" />
        </div>
        <div v-else class="flex flex-grow-1 flex-col items-center justify-center gap-4 p-10">
          <MicVocal class="mb-4 size-22 opacity-50" />
          <h2 class="text-base-content/80 text-2xl font-semibold">Letra faltante</h2>
          <p class="text-base-content/40">La letra de esta canción todavía no está disponible.</p>
        </div>

        <div
          class="border-base-300 md:rounded-box bg-base-100 relative border-t shadow-sm transition-[max-height] duration-300 md:border"
          :class="{ 'max-h-[45%]': tracksVisible, [isPWA ? 'max-h-6' : 'max-h-2']: !tracksVisible }"
        >
          <div
            class="md:rounded-box h-full overflow-y-auto transition-all duration-300"
            :class="{ 'opacity-0': !tracksVisible }"
          >
            <div class="overflow-hidden">
              <TrackPlayer
                v-for="(track, index) in displayedTracks"
                :key="index"
                :ref="
                  (el: any) => {
                    if (el) trackPlayers[index] = el;
                  }
                "
                class="pl-4 first:pt-2 last:pb-2"
                :track="track"
                :collection="collection"
                :is-playing="state.playing.value"
                :is-ready="state.trackStates.value[index]!.isReady"
                :volume="state.trackStates.value[index]!.volume"
                :has-lyrics="state.trackStates.value[index]!.hasLyrics"
                :lyrics-enabled="state.trackStates.value[index]!.lyricsEnabled"
                :edit-mode="uiStore.editMode"
                :audio-context="audioContext || undefined"
                @ready="(duration: number) => onReady(index, duration)"
                @time-update="(time: number) => onTimeUpdate(index, time)"
                @volume-change="(volume: number) => onVolumeChange(index, volume)"
                @toggle-muted="(toggleLyrics: boolean) => onToggleTrackMuted(index, toggleLyrics)"
                @toggle-solo="(toggleLyrics: boolean) => onSoloTrack(index, toggleLyrics)"
                @toggle-lyrics="() => onToggleTrackLyrics(track.id)"
                @seek="onSeekToTime"
                @finish="onFinish(index)"
              />
            </div>
          </div>

          <div
            class="pointer-events-none absolute inset-x-0 top-0 z-10 -mt-6 flex h-6 cursor-pointer justify-center"
          >
            <button
              class="bg-base-100 text-base-content/50 rounded-t-box border-base-300 pointer-events-auto flex w-16 cursor-pointer items-center justify-center border-t border-r border-l p-2"
              @click="tracksVisible = !tracksVisible"
            >
              <ChevronDown
                class="h-7 w-7 transition-transform duration-300"
                :class="{ 'rotate-180': !tracksVisible }"
              />
            </button>
          </div>

          <div
            v-if="!isReady"
            class="bg-base-100/80 text-base-content/50 md:rounded-box absolute inset-0 z-10 flex items-center justify-center gap-4 text-lg select-none"
          >
            <Loader2 class="size-6 animate-spin" />
            <span class="tracking-wide uppercase">Cargando...</span>
          </div>
        </div>
      </div>
    </div>

    <div class="drawer-side z-50">
      <label for="song-editor-drawer" aria-label="Cerrar editor" class="drawer-overlay"></label>
      <div
        class="bg-base-100/75 lg:bg-base-100 min-h-full w-full shadow-lg backdrop-blur-lg sm:w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] lg:w-[50vw]"
      >
        <SongEditor @toggle-edit="uiStore.toggleEditMode" />
      </div>
    </div>
  </div>
</template>
