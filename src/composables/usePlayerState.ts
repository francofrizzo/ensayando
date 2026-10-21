import { computed, ref, watch } from "vue";

import type { AudioTrackKind } from "@/data/types";

export type TrackInit = {
  id: number;
  hasLyrics: boolean;
  kind?: AudioTrackKind;
};

export type TrackState = {
  id: number;
  kind: AudioTrackKind;
  isReady: boolean;
  /** The track failed to load. It counts as resolved but stays out of the mix. */
  failed: boolean;
  /** Loading again after a failure ("Reintentar"): resolved for the player, silent. */
  retrying: boolean;
  /** Seconds, once loaded. */
  duration: number;
  /** Slider position, 0–1. Mute and solo never touch it. */
  volume: number;
  muted: boolean;
  soloed: boolean;
  hasLyrics: boolean;
  lyricsEnabled: boolean;
};

export type PlayerStateCallbacks = {
  onSeekTrack?: (trackIndex: number, time: number) => void;
};

/**
 * Solo filters voices, never instrumentals. Mute and volume apply to every track.
 * Playback, the mix download and sync all use the same gain.
 */
export function appliedGain(
  track: Pick<TrackState, "id" | "volume" | "muted" | "soloed" | "failed"> &
    Partial<Pick<TrackState, "retrying" | "kind">>,
  anySoloed: boolean
): number {
  if (track.failed || track.retrying || track.muted) return 0;
  if (anySoloed && track.kind !== "instrumental" && !track.soloed) return 0;
  return Math.max(0, Math.min(1, track.volume));
}

function createTrackState(init: TrackInit): TrackState {
  return {
    id: init.id,
    kind: init.kind ?? "unclassified",
    isReady: false,
    failed: false,
    retrying: false,
    duration: 0,
    volume: 1,
    muted: false,
    soloed: false,
    hasLyrics: init.kind !== "instrumental" && init.hasLyrics,
    lyricsEnabled: true
  };
}

export function usePlayerState(
  initialTracks: TrackInit[],
  callbacks?: PlayerStateCallbacks,
  songId?: number
) {
  let currentSongId = songId;
  const storageKey = () => `ens-rehearsal-mix-${currentSongId}`;
  const restoreTracks = (inits: TrackInit[]) => {
    const tracks = inits.map(createTrackState);
    if (currentSongId === undefined) return tracks;
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey()) ?? "null");
      if (!saved || typeof saved !== "object") return tracks;
      for (const track of tracks) {
        const mix: unknown = (saved as Record<string, unknown>)[track.id];
        if (!mix || typeof mix !== "object") continue;
        const values = mix as Record<string, unknown>;
        if (typeof values.volume === "number" && Number.isFinite(values.volume)) {
          track.volume = Math.max(0, Math.min(1, values.volume));
        }
        track.muted = values.muted === true;
        track.soloed = track.kind !== "instrumental" && values.soloed === true;
      }
    } catch {
      // Storage may be blocked or contain an invalid preference. Playback still works.
    }
    return tracks;
  };
  const trackStates = ref<TrackState[]>(restoreTracks(initialTracks));
  const playing = ref(false);
  const currentTime = ref(0);

  const hasCustomMix = computed(() =>
    trackStates.value.some((track) => track.volume !== 1 || track.muted || track.soloed)
  );
  watch(
    () => trackStates.value.map(({ id, volume, muted, soloed }) => ({ id, volume, muted, soloed })),
    (tracks) => {
      if (currentSongId === undefined) return;
      try {
        if (!hasCustomMix.value) localStorage.removeItem(storageKey());
        else
          localStorage.setItem(
            storageKey(),
            JSON.stringify(Object.fromEntries(tracks.map(({ id, ...mix }) => [id, mix])))
          );
      } catch {
        // A full or unavailable storage must not interrupt rehearsal.
      }
    },
    { flush: "sync" }
  );

  const anySoloed = computed(() => trackStates.value.some((t) => t.soloed && !t.failed));
  const gains = computed(() => trackStates.value.map((t) => appliedGain(t, anySoloed.value)));

  // A failed (or retrying) track counts as resolved; the player is ready once every
  // track is resolved and at least one of them actually loaded. Retrying one track
  // mid-playback doesn't block the others.
  const isReady = computed(
    () =>
      trackStates.value.length > 0 &&
      trackStates.value.every((t) => t.isReady || t.failed || t.retrying) &&
      trackStates.value.some((t) => t.isReady && !t.failed)
  );

  /** The first loaded track drives the clock; track 0 may have failed. */
  const referenceIndex = computed(() => trackStates.value.findIndex((t) => t.isReady && !t.failed));

  /**
   * The length the player shows and seeks within: the reference track's. The clock
   * follows that track, so a longer stem's tail could never actually be played.
   */
  const totalDuration = computed(() => trackStates.value[referenceIndex.value]?.duration ?? 0);

  const trackIdsWithLyricsEnabled = computed(() =>
    trackStates.value
      .filter((track) => track.kind !== "instrumental" && track.lyricsEnabled)
      .map((track) => track.id)
  );

  // Tracks that go from silent to audible must jump to the current time,
  // because WaveSurfer may have paused them while silent.
  const withAudibilityCheck = (change: () => void) => {
    const before = gains.value.slice();
    change();
    gains.value.forEach((gain, i) => {
      if ((before[i] ?? 0) === 0 && gain > 0) {
        callbacks?.onSeekTrack?.(i, currentTime.value);
      }
    });
  };

  // --- Track lifecycle ---

  const onReady = (trackIndex: number, duration: number) => {
    const track = trackStates.value[trackIndex];
    if (!track) return;
    const wasRetrying = track.retrying;
    track.isReady = true;
    track.failed = false;
    track.retrying = false;
    track.duration = duration;
    // A track that came back mid-song joins at the current time, not from 0.
    if (wasRetrying) callbacks?.onSeekTrack?.(trackIndex, currentTime.value);
  };

  const onTrackError = (trackIndex: number) => {
    const track = trackStates.value[trackIndex];
    if (!track) return;
    track.failed = true;
    track.retrying = false;
    track.isReady = false;
  };

  const onTrackRetry = (trackIndex: number) => {
    const track = trackStates.value[trackIndex];
    if (!track) return;
    track.failed = false;
    track.retrying = true;
    track.isReady = false;
  };

  const onTimeUpdate = (trackIndex: number, time: number) => {
    if (trackIndex === referenceIndex.value) {
      currentTime.value = time;
    }
  };

  const onFinish = (trackIndex: number) => {
    // The same track owns both the clock and the end of the song. Shorter stems
    // can finish first without cutting off the rest of the mix.
    if (trackIndex === referenceIndex.value) {
      playing.value = false;
    }
  };

  // --- Volume, mute and solo ---

  const resetMix = () =>
    withAudibilityCheck(() => {
      trackStates.value = trackStates.value.map((track) => ({
        ...track,
        volume: 1,
        muted: false,
        soloed: false
      }));
    });

  const onTrackKindChange = (trackIndex: number, kind: AudioTrackKind) => {
    const track = trackStates.value[trackIndex];
    if (!track || track.kind === kind) return;
    withAudibilityCheck(() => {
      track.kind = kind;
      if (kind === "instrumental") track.soloed = false;
    });
  };

  const setTrackLyricsEnabled = (trackId: number, enabled: boolean) => {
    const track = trackStates.value.find((t) => t.id === trackId);
    if (track) track.lyricsEnabled = enabled;
  };

  const onVolumeChange = (trackIndex: number, volume: number) => {
    const track = trackStates.value[trackIndex];
    if (!track) return;
    withAudibilityCheck(() => {
      track.volume = Math.max(0, Math.min(1, volume));
    });
  };

  /** Tap on M. With Shift, the track's lyrics follow its mute state (as before). */
  const onToggleTrackMuted = (trackIndex: number, toggleLyrics = false) => {
    const track = trackStates.value[trackIndex];
    if (!track) return;
    withAudibilityCheck(() => {
      track.muted = !track.muted;
      if (toggleLyrics) setTrackLyricsEnabled(track.id, !track.muted);
    });
  };

  /** Tap on S (or long press / ⌘+click on M). Several tracks can be soloed at once. */
  const onSoloTrack = (trackIndex: number, toggleLyrics = false) => {
    const track = trackStates.value[trackIndex];
    if (!track || track.kind === "instrumental") return;
    withAudibilityCheck(() => {
      track.soloed = !track.soloed;
      if (toggleLyrics) {
        const anySolo = trackStates.value.some((t) => t.soloed);
        trackStates.value.forEach((t) => {
          t.lyricsEnabled = !anySolo || t.soloed;
        });
      }
    });
  };

  // --- Lyrics visibility ---

  const onToggleTrackLyrics = (trackId: number) => {
    const track = trackStates.value.find((t) => t.id === trackId);
    if (track) track.lyricsEnabled = !track.lyricsEnabled;
  };

  const onSoloTrackLyrics = (trackId: number) => {
    const target = trackStates.value.find((t) => t.id === trackId);
    if (!target) return;
    const isCurrentlySoloed = trackStates.value.every(
      (track) => track.id === trackId || !track.lyricsEnabled
    );
    trackStates.value.forEach((track) => {
      track.lyricsEnabled = track.id === trackId || isCurrentlySoloed;
    });
  };

  // --- Song change ---

  const resetForNewSong = (newTracks: TrackInit[], newSongId?: number) => {
    currentTime.value = 0;
    playing.value = false;
    currentSongId = newSongId;
    trackStates.value = restoreTracks(newTracks);
  };

  return {
    // State
    trackStates,
    playing,
    currentTime,
    totalDuration,

    // Computeds
    isReady,
    gains,
    anySoloed,
    referenceIndex,
    trackIdsWithLyricsEnabled,

    // Track lifecycle
    onReady,
    onTrackError,
    onTrackRetry,
    onTimeUpdate,
    onFinish,

    // Volume, mute and solo
    hasCustomMix,
    resetMix,
    onTrackKindChange,
    onVolumeChange,
    onToggleTrackMuted,
    onSoloTrack,

    // Lyrics visibility
    onToggleTrackLyrics,
    onSoloTrackLyrics,

    // Song change
    resetForNewSong
  };
}
