<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, toRef, watch } from "vue";
import {
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
  type RouteLocationNormalized,
  useRouter
} from "vue-router";
import { toast } from "vue-sonner";
import type WaveSurfer from "wavesurfer.js";

import EditBar from "@/components/editor/EditBar.vue";
import EditorPanels from "@/components/editor/EditorPanels.vue";
import UnsavedChangesDialog from "@/components/editor/UnsavedChangesDialog.vue";
import LyricsViewer from "@/components/lyrics/LyricsViewer.vue";
import MyPartMenu from "@/components/player/MyPartMenu.vue";
import PlayerControls from "@/components/player/PlayerControls.vue";
import PlayerShortcutsModal from "@/components/player/PlayerShortcutsModal.vue";
import PlayerTopBar from "@/components/player/PlayerTopBar.vue";
import ProgressBar from "@/components/player/ProgressBar.vue";
import TrackPlayer from "@/components/player/TrackPlayer.vue";
import { IconChevronDown, IconChevronUp, IconLyrics, IconMixer } from "@/components/ui/icons";
import LoadingWaveform from "@/components/ui/LoadingWaveform.vue";
import RoomLight from "@/components/ui/RoomLight.vue";
import { useCollectionPalette } from "@/composables/useCollectionPalette";
import { useCurrentSong } from "@/composables/useCurrentSong";
import { provideEditorSession } from "@/composables/useEditorSession";
import { providePlayerState } from "@/composables/useCurrentTime";
import { useMediaSession } from "@/composables/useMediaSession";
import { useMyPart } from "@/composables/useMyPart";
import { useNavigation } from "@/composables/useNavigation";
import { type TrackInit, usePlayerState } from "@/composables/usePlayerState";
import { artworkPlaybackUrl, audioPlaybackUrl } from "@/data/storage";
import type { CollectionWithRole, LyricStanza, Song } from "@/data/types";
import { useCollectionsStore } from "@/stores/collections";
import { useUIStore } from "@/stores/ui";
import { COMMAND_EVENT, type CommandEventDetail, dispatchPlayback } from "@/utils/appEvents";
import { mixAndEncodeMp3 } from "@/utils/mixdown";
import { myPartForSong } from "@/utils/myPart";
import { isIOS } from "@/utils/platform";
import { nextStanzaTime, previousStanzaTime, stanzaStartTimes } from "@/utils/stanzaNavigation";
import { cleanupWaveSurfer } from "@/utils/wavesurfer-cleanup";

const props = defineProps<{
  collection: CollectionWithRole;
  song: Song;
  lyrics: LyricStanza[];
}>();

const uiStore = useUIStore();
const collectionsStore = useCollectionsStore();
const router = useRouter();
const { prevSong, nextSong } = useCurrentSong();

const canEdit = computed(() => collectionsStore.canEditCurrentCollection);
const isAdmin = computed(() => props.collection.user_role === "admin");
const { navigateToSong } = useNavigation();

// General state
const sortedTracks = computed(() => {
  return [...props.song.audio_tracks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
});

const tracksIdsWithLyrics = computed(() => {
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
});

const buildTrackInits = (): TrackInit[] =>
  sortedTracks.value.map((track) => ({
    id: track.id,
    hasLyrics: tracksIdsWithLyrics.value.includes(track.id)
  }));

// "Mi parte": remembered per collection; only this song's tracks count here.
const myPartStore = useMyPart(computed(() => props.collection.id));
const myPart = computed(() =>
  myPartForSong(
    myPartStore.part.value,
    sortedTracks.value.map((track) => track.id)
  )
);

const state = usePlayerState(
  buildTrackInits(),
  {
    onSeekTrack: (trackIndex, time) => {
      trackPlayers.value[trackIndex]?.seekTo(time);
    }
  },
  { myPart }
);

const { isReady, trackIdsWithLyricsEnabled } = state;

// Platform detection — isIOS imported from @/utils/platform

// iOS sequential decode: rendering is not restricted anymore; we call beginLoad sequentially instead

providePlayerState({
  currentTime: state.currentTime,
  totalDuration: state.totalDuration,
  isPlaying: state.playing,
  isReady,
  seekTo: (time: number) => onSeekToTime(time),
  playPause: (play?: boolean) => {
    if (play === undefined || play !== state.playing.value) void onPlayPause(play);
  }
});
// Cleanup and reset when switching songs to prevent lingering decoders/buffers
watch(
  () => props.song.id,
  () => {
    try {
      trackPlayers.value.forEach((player, index) => {
        void cleanupWaveSurfer(player?.waveSurfer ?? null).catch((error: unknown) => {
          handleAudioError(error as Error, `destroy wavesurfer on song change ${index}`);
        });
      });
      trackPlayers.value = [];
    } catch (error) {
      handleAudioError(error as Error, "reset track players on song change");
    }

    // Reset state for new song
    state.resetForNewSong(buildTrackInits());

    // Start first decode on iOS for new song (nextTick so template refs are populated)
    if (isIOS) {
      nextTick(() => {
        const first = trackPlayers.value[0];
        if (first && typeof first.beginLoad === "function") {
          try {
            first.beginLoad();
          } catch {
            // ignore
          }
        }
      });
    }
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
  state.onReady(trackIndex, duration);
  // On iOS, trigger sequential decode by calling beginLoad on next deferred track
  if (isIOS) {
    const nextIndex = trackIndex + 1;
    if (nextIndex < trackPlayers.value.length) {
      try {
        trackPlayers.value[nextIndex]?.beginLoad?.();
      } catch {
        // no-op
      }
    }
  }
};

const onTrackError = (trackIndex: number) => {
  // A failed track counts as resolved: the rest of the song still plays.
  state.onTrackError(trackIndex);
  // On iOS, continue sequential decode even if a track fails
  if (isIOS) {
    const nextIndex = trackIndex + 1;
    if (nextIndex < trackPlayers.value.length) {
      try {
        trackPlayers.value[nextIndex]?.beginLoad?.();
      } catch {
        // no-op
      }
    }
  }
};

const onTrackRetry = (trackIndex: number) => {
  state.onTrackRetry(trackIndex);
  trackPlayers.value[trackIndex]?.retry();
};

const onPlayPause = async (forcePlay?: boolean) => {
  if (isInitializing.value) return;

  // Check if tracks are ready before allowing playback
  if (!isReady.value && (forcePlay === true || forcePlay === undefined)) {
    handleAudioError(new Error("Cannot start playback: tracks are not ready"), "onPlayPause");
    return;
  }

  isInitializing.value = true;
  try {
    // If AudioContext exists but is suspended, try to resume it within user gesture
    if (audioContext.value?.state === "suspended") {
      await audioContext.value.resume();
    }

    // Initialize audio context for WebAudio API user gesture requirement
    if (!hasInitializedAudio.value) {
      await initializeAudioContext();
      // Try to play silent audio to unlock WebAudio context
      if (silentAudio.value) {
        try {
          await silentAudio.value.play();
        } catch (playError) {
          console.debug("Silent audio play was blocked or failed:", playError);
        }
      }
    }

    state.playing.value = forcePlay ?? !state.playing.value;
  } catch (error) {
    handleAudioError(error as Error, "onPlayPause");
  } finally {
    isInitializing.value = false;
  }
};

const onSeekToTime = (time: number) => {
  seekAllTracks(time);
};

const stanzaStarts = computed(() => stanzaStartTimes(props.lyrics));

const goToSong = (song: Song | null) => {
  if (song) navigateToSong(props.collection, song);
};

const showShortcuts = ref(false);

const openSettings = () => {
  router.push(`/${props.collection.slug}/ajustes/general`);
};

// Commands from the library and ⌘K (src/utils/appEvents.ts).
const onCommand = (event: Event) => {
  const { id } = (event as CustomEvent<CommandEventDetail>).detail;
  if (id === "download-mix") {
    void onDownloadMix();
  } else if (id === "edit-song" && canEdit.value) {
    uiStore.openEditor(uiStore.editTab ?? "cancion");
  } else if (id === "new-song" && canEdit.value) {
    void router.push({ name: "new-song", params: { collectionSlug: props.collection.slug } });
  }
};

// ---------- Edit mode ----------
// Editing is a mode of this screen (?editar=…): the edit bar replaces the top bar, the
// editor replaces the stage and the dock stays so you can listen while editing.
const editor = provideEditorSession();

// Someone without edit rights (or a stale link) lands on ?editar: drop it.
watch(
  () => [uiStore.editTab, canEdit.value] as const,
  ([tab, allowed]) => {
    if (tab && !allowed && !collectionsStore.isLoading) uiStore.closeEditor();
  },
  { immediate: true }
);

/** Leaving edit mode, or this song, with unsaved changes asks first. */
const leavesEditor = (to: RouteLocationNormalized, from: RouteLocationNormalized) =>
  "editar" in from.query &&
  (!("editar" in to.query) ||
    to.params.songSlug !== from.params.songSlug ||
    to.params.collectionSlug !== from.params.collectionSlug);

const guardLeave = async () => {
  if (!editor.isDirty.value) return true;
  const choice = await editor.confirmLeave();
  if (choice === "stay") return false;
  if (choice === "save") return await editor.save();
  await editor.discard();
  return true;
};

onBeforeRouteUpdate((to, from) => (leavesEditor(to, from) ? guardLeave() : true));
onBeforeRouteLeave(() => (uiStore.editMode ? guardLeave() : true));

const onBeforeUnload = (event: BeforeUnloadEvent) => {
  if (uiStore.editMode && editor.isDirty.value) {
    event.preventDefault();
    event.returnValue = "";
  }
};

// ⌘S saves everything in edit mode (capture: it wins over the lyrics editor and the browser).
const onSaveShortcut = (event: KeyboardEvent) => {
  if (!uiStore.editMode) return;
  if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "s") {
    event.preventDefault();
    event.stopPropagation();
    void editor.save();
  }
};

// Let the library animate its "now playing" bars.
watch(
  () => state.playing.value,
  (playing) => dispatchPlayback(playing)
);

const keydownHandler = (event: KeyboardEvent) => {
  // Check if the event originates from an capturing element
  const target = event.target as HTMLElement;
  const isInCapturingElement =
    target &&
    (target.closest(".jse-modal") || target.closest("input") || target.closest("textarea")) &&
    !event.ctrlKey;
  const isTyping = !!target?.closest("input, textarea, [contenteditable='true'], .jse-modal");
  const hasCommandModifier = event.metaKey || event.ctrlKey;

  if (event.key === " " && (!isInCapturingElement || event.ctrlKey)) {
    event.preventDefault();
    onPlayPause();
  } else if (event.key === "ArrowLeft" && (!isInCapturingElement || event.altKey)) {
    event.preventDefault();
    const step = event.shiftKey ? 3.0 : 0.1;
    const newTime = Math.max(0, state.currentTime.value - step);
    onSeekToTime(newTime);
  } else if (event.key === "ArrowRight" && (!isInCapturingElement || event.altKey)) {
    event.preventDefault();
    const step = event.shiftKey ? 3.0 : 0.1;
    const newTime = Math.min(state.totalDuration.value, state.currentTime.value + step);
    onSeekToTime(newTime);
  } else if (
    event.key.toLowerCase() === "e" &&
    hasCommandModifier &&
    event.shiftKey &&
    !isInCapturingElement
  ) {
    event.preventDefault();
    onDownloadMix();
  } else if (isTyping || hasCommandModifier || uiStore.editMode) {
    // Everything below is a plain key; the editor owns the keyboard while editing.
    return;
  } else if ((event.key === "ArrowUp" || event.key === "ArrowDown") && event.shiftKey) {
    event.preventDefault();
    goToSong(event.key === "ArrowUp" ? prevSong.value : nextSong.value);
  } else if (event.key === "ArrowUp" && !event.altKey) {
    event.preventDefault();
    onSeekToTime(previousStanzaTime(stanzaStarts.value, state.currentTime.value));
  } else if (event.key === "ArrowDown" && !event.altKey) {
    const next = nextStanzaTime(stanzaStarts.value, state.currentTime.value);
    event.preventDefault();
    if (next !== null) onSeekToTime(next);
  } else if (/^Digit[1-9]$/.test(event.code)) {
    // event.code: on a Mac, ⌥+digit types another character.
    const index = Number(event.code.slice(5)) - 1;
    if (index >= sortedTracks.value.length) return;
    event.preventDefault();
    if (event.altKey) state.onSoloTrack(index);
    else state.onToggleTrackMuted(index, event.shiftKey);
  } else if (event.key.toLowerCase() === "e" && !event.altKey && canEdit.value) {
    event.preventDefault();
    uiStore.openEditor();
  } else if (event.key === "?") {
    event.preventDefault();
    showShortcuts.value = !showShortcuts.value;
  } else if (event.key === "Escape" && showShortcuts.value) {
    showShortcuts.value = false;
  }
};

onMounted(() => {
  window.addEventListener("keydown", keydownHandler);
  window.addEventListener("keydown", onSaveShortcut, true);
  window.addEventListener("beforeunload", onBeforeUnload);
  window.addEventListener(COMMAND_EVENT, onCommand);
  initMediaSession();
  // Kick off sequential decode on iOS: use nextTick so template refs are populated
  if (isIOS) {
    nextTick(() => {
      const first = trackPlayers.value[0];
      if (first && typeof first.beginLoad === "function") {
        try {
          first.beginLoad();
        } catch {
          // ignore
        }
      }
    });
  }
});

onUnmounted(async () => {
  try {
    window.removeEventListener("keydown", keydownHandler);
    window.removeEventListener("keydown", onSaveShortcut, true);
    window.removeEventListener("beforeunload", onBeforeUnload);
    window.removeEventListener(COMMAND_EVENT, onCommand);
    dispatchPlayback(false);
  } catch (error) {
    handleAudioError(error as Error, "removeEventListener");
  }

  try {
    stopSyncCheck();
  } catch (error) {
    handleAudioError(error as Error, "stopSyncCheck");
  }

  // Belt-and-suspenders: children normally clean themselves up on unmount, but
  // run cleanup here too in case a TrackPlayer somehow lingered. cleanupWaveSurfer
  // is a no-op on null, which is what child refs will be by the time this runs.
  trackPlayers.value.forEach((player, index) => {
    void cleanupWaveSurfer(player?.waveSurfer ?? null).catch((error: unknown) => {
      handleAudioError(error as Error, `destroying wavesurfer ${index}`);
    });
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
  try {
    await audioContext.value?.close();
  } catch {
    /* ignore cleanup errors */
  }
  audioContext.value = null;

  if (silentAudio.value) {
    try {
      silentAudio.value.pause();
      silentAudio.value.src = "";
      silentAudio.value = null;
    } catch (error) {
      handleAudioError(error as Error, "silentAudio cleanup");
      silentAudio.value = null;
    }
  }
});

// UI/Visual related state
// Phone: the dock is a sheet that starts closed. Desktop: the mixer starts open.
const phoneQuery = window.matchMedia("(max-width: 767px)");
const isPhone = ref(phoneQuery.matches);
const onPhoneQueryChange = (event: MediaQueryListEvent) => {
  isPhone.value = event.matches;
};
phoneQuery.addEventListener("change", onPhoneQueryChange);
onUnmounted(() => phoneQuery.removeEventListener("change", onPhoneQueryChange));
const mixerOpen = ref(!isPhone.value);

// The dock starts compact while editing and comes back as it was.
let mixerOpenBeforeEdit: boolean | null = null;
watch(
  () => uiStore.editMode,
  (editing) => {
    if (editing) {
      mixerOpenBeforeEdit = mixerOpen.value;
      mixerOpen.value = false;
    } else if (mixerOpenBeforeEdit !== null) {
      mixerOpen.value = mixerOpenBeforeEdit;
      mixerOpenBeforeEdit = null;
      editor.jsonOpen.value = false;
    }
  },
  { immediate: true }
);

const { trackColor } = useCollectionPalette(toRef(props, "collection"));
const progress = computed(() =>
  state.totalDuration.value > 0 ? state.currentTime.value / state.totalDuration.value : 0
);

// Audio playing trickery
const trackPlayers = ref<InstanceType<typeof TrackPlayer>[]>([]);
const syncInterval = ref<number | null>(null);
const SYNC_CHECK_INTERVAL = 1000;
const DRIFT_THRESHOLD = 0.15;
const hasInitializedAudio = ref(false);
const silentAudio = ref<HTMLAudioElement | null>(null);
const audioContext = ref<AudioContext | null>(null);
const audioStateChangeHandlerRef = ref<((this: AudioContext, ev: Event) => void) | null>(null);

const isInitializing = ref(false);
const exporting = ref(false);

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const onDownloadMix = async () => {
  if (!isReady.value || exporting.value) return;
  exporting.value = true;

  const toastId = toast.loading("Preparando la mezcla…");

  try {
    // The mix uses what you hear: volume, mute, solo and Mi parte. Failed tracks stay out.
    const urls = sortedTracks.value.map((track, i) =>
      state.trackStates.value[i]?.failed ? null : audioPlaybackUrl(track) || null
    );
    const gains = state.gains.value.slice();
    const sampleRate = audioContext.value?.sampleRate ?? 44100;
    const duration = state.totalDuration.value;

    const buffers = trackPlayers.value.map((player) => {
      const ws = player?.waveSurfer as
        | (WaveSurfer & {
            getDecodedData?: () => AudioBuffer | null;
            backend?: { buffer?: AudioBuffer; audioContext?: AudioContext };
          })
        | null;
      if (!ws) return null;
      try {
        if (typeof ws.getDecodedData === "function") {
          const data = ws.getDecodedData();
          if (data) return data as AudioBuffer;
        }
      } catch {
        /* no-op: ws.getDecodedData may throw on some backends */
      }
      try {
        if (ws.backend?.buffer) {
          return ws.backend.buffer as AudioBuffer;
        }
      } catch {
        /* no-op: backend buffer access may throw if backend differs */
      }
      return null;
    });

    const blob = await mixAndEncodeMp3(urls, gains, {
      duration,
      sampleRate,
      buffers,
      bitrateKbps: 192
    });
    const safeTitle = (props.song.title || "mix")
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-_]/g, "");
    downloadBlob(blob, `${safeTitle}-mix.mp3`);

    toast.success("Mezcla descargada", {
      id: toastId,
      description: `${safeTitle}-mix.mp3`
    });
  } catch (error) {
    handleAudioError(error as Error, "onDownloadMix");
    toast.error("No se pudo preparar la mezcla", {
      id: toastId,
      description: "Probá de nuevo en un momento."
    });
  } finally {
    exporting.value = false;
  }
};

const checkAndCorrectSync = () => {
  if (!state.playing.value || !isReady.value) return;
  if (audioContext.value?.state !== "running") return;

  const referenceIndex = state.referenceIndex.value;
  const referenceTrack = trackPlayers.value[referenceIndex];
  if (!referenceTrack?.waveSurfer) return;

  try {
    const referenceTime = referenceTrack.waveSurfer.getCurrentTime?.() ?? 0;

    // Only proceed if we have a valid reference time (not 0 unless actually at start)
    if (referenceTime < 0) return;

    trackPlayers.value.forEach((player, index) => {
      if (!player?.waveSurfer || index === referenceIndex) return; // Skip reference track
      if (state.gains.value[index] === 0) return; // Silent tracks re-seek when they become audible

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
      const firstTrack = trackPlayers.value[state.referenceIndex.value];
      if (firstTrack?.waveSurfer) {
        const ws = firstTrack.waveSurfer as WaveSurfer & {
          backend?: { audioContext?: AudioContext };
        };
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
  artwork: artworkPlaybackUrl(props.collection),
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
  onSeek: (time) => onSeekToTime(time),
  onPreviousTrack: () => goToSong(prevSong.value),
  onNextTrack: () => goToSong(nextSong.value)
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
    mediaSessionTime.value = Math.min(time, state.totalDuration.value);
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
      const w = window as typeof window & { webkitAudioContext?: typeof AudioContext };
      const AudioContextCtor: typeof AudioContext | undefined =
        w.AudioContext || w.webkitAudioContext;
      if (AudioContextCtor) {
        audioContext.value = new AudioContextCtor({
          sampleRate: 44100,
          latencyHint: "playback" as AudioContextLatencyCategory
        });
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
        try {
          silentAudio.value?.pause();
          silentAudio.value = null;
        } catch {
          /* ignore cleanup errors */
        }
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
  <div class="bg-base-200 relative isolate flex h-dvh min-w-0 flex-col overflow-hidden select-none">
    <RoomLight :collection="collection" :playing="state.playing.value" />

    <div
      class="relative z-20 px-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] md:px-3.5 md:pt-3.5"
    >
      <EditBar
        v-if="uiStore.editMode"
        :title="song.title"
        :tab="uiStore.editTab ?? 'cancion'"
        @exit="uiStore.closeEditor()"
        @tab="uiStore.setEditorTab"
      />
      <PlayerTopBar
        v-else
        :collection="collection"
        :song="song"
        :song-count="collectionsStore.songs.length"
        :tracks="sortedTracks"
        :my-part="myPart"
        :can-edit="canEdit"
        :is-admin="isAdmin"
        :edit-mode="uiStore.editMode"
        :exporting="exporting"
        :can-download="isReady"
        @library="uiStore.openLibrary()"
        @search="uiStore.openCommandPalette()"
        @edit="uiStore.openEditor()"
        @download="onDownloadMix"
        @shortcuts="showShortcuts = true"
        @settings="openSettings"
        @my-part-toggle="myPartStore.toggleTrack"
        @my-part-duck="myPartStore.setDuckOthers"
        @my-part-clear="myPartStore.clear"
      />
    </div>

    <!-- Edit mode: the editor takes the stage; the dock below keeps playing. -->
    <div
      v-if="uiStore.editMode"
      class="relative z-10 flex min-h-0 flex-1 flex-col px-2.5 py-2.5 md:px-3.5 md:py-3"
    >
      <EditorPanels :tab="uiStore.editTab ?? 'cancion'" />
    </div>

    <!-- Stage: the lyrics. Never inside glass (gradient text vanishes under backdrop-filter). -->
    <div
      v-else-if="lyrics.length > 0"
      class="relative min-h-0 flex-grow-1 snap-y overflow-auto py-10"
      style="
        animation: fade-in 300ms ease-out 100ms both;
        mask-image: linear-gradient(transparent, #000 48px, #000 calc(100% - 48px), transparent);
      "
    >
      <LyricsViewer
        :lyrics="lyrics"
        :current-time="state.currentTime.value"
        :is-disabled="!isReady"
        :collection="collection"
        :enabled-track-ids="trackIdsWithLyricsEnabled"
        :my-part="myPart"
        @seek="onSeekToTime"
      />
    </div>
    <div v-else class="flex min-h-0 flex-grow-1 flex-col items-center justify-center gap-4 p-10">
      <IconLyrics
        class="empty-state-enter-active mb-4 size-22 opacity-50"
        style="animation: empty-stagger 400ms ease-out both; animation-delay: 0ms"
      />
      <h2
        class="text-base-content/80 text-2xl font-semibold"
        style="animation: empty-stagger 400ms ease-out both; animation-delay: 80ms"
      >
        Letra faltante
      </h2>
      <p
        class="text-base-content/40"
        style="animation: empty-stagger 400ms ease-out both; animation-delay: 160ms"
      >
        La letra de esta canción todavía no está disponible.
      </p>
    </div>

    <!-- Dock (desktop) / sheet (phone). Sincronizar brings its own transport, so it hides
         (v-show: the track players inside must stay mounted to keep playing). -->
    <div
      v-show="!(uiStore.editMode && uiStore.editTab === 'sincronizar')"
      class="glass-2 relative z-10 mx-2 mb-[max(0.5rem,env(safe-area-inset-bottom))] flex flex-col gap-2.5 rounded-[28px] px-4 pt-2 pb-3 md:mx-3.5 md:mb-3.5 md:gap-1.5 md:rounded-[22px] md:px-[18px] md:pt-3"
      data-testid="player-dock"
    >
      <button
        class="bg-base-content/20 mx-auto h-[5px] w-[38px] shrink-0 rounded-full md:hidden"
        :aria-label="mixerOpen ? 'Cerrar las pistas' : 'Abrir las pistas'"
        @click="mixerOpen = !mixerOpen"
      />

      <ProgressBar
        class="md:hidden"
        :current-time="state.currentTime.value"
        :total-duration="state.totalDuration.value"
        :disabled="!isReady"
        @seek="onSeekToTime"
      />

      <PlayerControls
        class="md:h-[58px]"
        :compact="isPhone"
        :current-time="state.currentTime.value"
        :total-duration="state.totalDuration.value"
        :is-playing="state.playing.value"
        :is-ready="isReady"
        :prev-song="prevSong"
        :next-song="nextSong"
        @play-pause="onPlayPause"
        @skip-prev="goToSong(prevSong)"
        @skip-next="goToSong(nextSong)"
      >
        <button
          class="btn btn-sm btn-ghost text-base-content/60 hidden gap-1.5 rounded-full font-semibold md:inline-flex"
          data-testid="toggle-mixer"
          @click="mixerOpen = !mixerOpen"
        >
          <component :is="mixerOpen ? IconChevronDown : IconChevronUp" class="size-4" />
          {{ mixerOpen ? "Ocultar pistas" : "Mostrar pistas" }}
        </button>
        <button
          class="btn btn-circle btn-ghost md:hidden"
          :class="{ 'bg-collection-soft text-collection-ink': mixerOpen }"
          :aria-label="mixerOpen ? 'Cerrar las pistas' : 'Abrir las pistas'"
          @click="mixerOpen = !mixerOpen"
        >
          <IconMixer class="size-5" />
        </button>
      </PlayerControls>

      <ProgressBar
        v-if="!mixerOpen"
        class="hidden md:flex"
        :current-time="state.currentTime.value"
        :total-duration="state.totalDuration.value"
        :disabled="!isReady"
        @seek="onSeekToTime"
      />

      <!-- Phone, sheet closed: tracks as chips; a tap mutes -->
      <div
        v-if="!mixerOpen"
        class="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] md:hidden"
        style="mask-image: linear-gradient(90deg, #000 85%, transparent)"
      >
        <button
          v-for="(track, index) in sortedTracks"
          :key="track.id"
          class="bg-base-content/6 flex shrink-0 items-center gap-1.5 rounded-full py-[7px] pr-2.5 pl-[9px] text-[12.5px] font-semibold whitespace-nowrap"
          :class="{ 'text-base-content/40 line-through': state.gains.value[index] === 0 }"
          :aria-pressed="!state.trackStates.value[index]?.muted"
          @click="state.onToggleTrackMuted(index)"
        >
          <span
            class="size-2 rounded-full"
            :style="{
              background:
                state.gains.value[index] === 0
                  ? 'var(--color-base-content)'
                  : trackColor(track.color_key, 'wave'),
              opacity: state.gains.value[index] === 0 ? 0.35 : 1
            }"
          />
          {{ track.title }}
        </button>
      </div>

      <!-- Mixer: always mounted (the tracks are the audio); collapsed with height -->
      <div
        class="relative -mx-4 overflow-y-auto overscroll-contain px-4 transition-[max-height,opacity] duration-300 md:-mx-[18px] md:pr-[18px] md:pl-8"
        :class="
          mixerOpen
            ? 'max-h-[55dvh] opacity-100 md:max-h-[42dvh]'
            : 'pointer-events-none max-h-0 opacity-0'
        "
        :aria-hidden="!mixerOpen || undefined"
        data-testid="mixer"
      >
        <div
          v-if="sortedTracks.length > 1"
          class="flex items-center justify-between pb-2 md:hidden"
        >
          <span class="text-base-content/50 text-[11px] font-semibold tracking-[0.1em] uppercase"
            >Pistas</span
          >
          <MyPartMenu
            :collection="collection"
            :tracks="sortedTracks"
            :part="myPart"
            @toggle-track="myPartStore.toggleTrack"
            @set-duck="myPartStore.setDuckOthers"
            @clear="myPartStore.clear"
          />
        </div>
        <div class="relative flex flex-col md:py-1">
          <TrackPlayer
            v-for="(track, index) in sortedTracks"
            :key="index"
            :ref="
              (el) => {
                if (el) trackPlayers[index] = el as InstanceType<typeof TrackPlayer>;
              }
            "
            :style="
              isReady
                ? {
                    animation: `empty-stagger 300ms ease-out both`,
                    animationDelay: `${index * 50}ms`
                  }
                : { opacity: 0 }
            "
            :track="track"
            :collection="collection"
            :position="index < 9 ? index + 1 : undefined"
            :is-playing="state.playing.value"
            :is-ready="state.trackStates.value[index]!.isReady"
            :failed="state.trackStates.value[index]!.failed"
            :volume="state.trackStates.value[index]!.volume"
            :gain="state.gains.value[index] ?? 0"
            :muted="state.trackStates.value[index]!.muted"
            :soloed="state.trackStates.value[index]!.soloed"
            :has-lyrics="state.trackStates.value[index]!.hasLyrics"
            :lyrics-enabled="state.trackStates.value[index]!.lyricsEnabled"
            :edit-mode="uiStore.editMode"
            :audio-context="audioContext || undefined"
            :defer-load="isIOS"
            @ready="(duration: number) => onReady(index, duration)"
            @time-update="(time: number) => state.onTimeUpdate(index, time)"
            @volume-change="(volume: number) => state.onVolumeChange(index, volume)"
            @toggle-muted="(toggleLyrics: boolean) => state.onToggleTrackMuted(index, toggleLyrics)"
            @toggle-solo="(toggleLyrics: boolean) => state.onSoloTrack(index, toggleLyrics)"
            @toggle-lyrics="() => state.onToggleTrackLyrics(track.id)"
            @solo-lyrics="() => state.onSoloTrackLyrics(track.id)"
            @seek="onSeekToTime"
            @finish="state.onFinish(index)"
            @error="onTrackError(index)"
            @retry="onTrackRetry(index)"
          />
          <!-- Playhead across every wave (name column 198px + 16px gap) -->
          <span
            v-if="isReady"
            class="bg-base-content pointer-events-none absolute inset-y-0 hidden w-0.5 rounded-full md:block"
            :style="{ left: `calc(214px + (100% - 214px) * ${progress})` }"
          />
        </div>

        <div
          v-if="!isReady && mixerOpen"
          class="absolute inset-0 z-10 flex items-center justify-center select-none"
        >
          <div
            class="text-base-content/45 flex flex-col items-center gap-4"
            style="animation: pulse-subtle 3s ease-in-out infinite"
          >
            <LoadingWaveform size="lg" :bar-count="12" />
            <span class="text-sm tracking-wide">Cargando...</span>
          </div>
        </div>
      </div>
    </div>

    <UnsavedChangesDialog />

    <PlayerShortcutsModal
      :show="showShortcuts"
      :can-edit="canEdit"
      @close="showShortcuts = false"
    />
  </div>
</template>
