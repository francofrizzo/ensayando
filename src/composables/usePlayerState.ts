import { computed, ref, type Ref } from "vue";

export type TrackInit = {
  id: number;
  hasLyrics: boolean;
};

export type TrackState = {
  id: number;
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

export type MyPartState = {
  trackIds: number[];
  /** Lower the tracks outside "Mi parte" by 6 dB. */
  duckOthers: boolean;
};

export type PlayerStateCallbacks = {
  onSeekTrack?: (trackIndex: number, time: number) => void;
};

export type PlayerStateOptions = {
  myPart?: Ref<MyPartState | null>;
};

/** −6 dB as a linear gain. */
export const DUCK_GAIN = 0.5;

/**
 * What a track actually sounds at: volume × not muted × (no solos, or this one
 * is soloed) × Mi parte ducking. Playback, the mix download and sync all use it.
 */
export function appliedGain(
  track: Pick<TrackState, "id" | "volume" | "muted" | "soloed" | "failed"> &
    Partial<Pick<TrackState, "retrying">>,
  anySoloed: boolean,
  myPart?: MyPartState | null
): number {
  if (track.failed || track.retrying || track.muted) return 0;
  if (anySoloed && !track.soloed) return 0;
  const duck =
    myPart?.duckOthers && myPart.trackIds.length > 0 && !myPart.trackIds.includes(track.id)
      ? DUCK_GAIN
      : 1;
  return Math.max(0, Math.min(1, track.volume)) * duck;
}

function createTrackState(init: TrackInit): TrackState {
  return {
    id: init.id,
    isReady: false,
    failed: false,
    retrying: false,
    duration: 0,
    volume: 1,
    muted: false,
    soloed: false,
    hasLyrics: init.hasLyrics,
    lyricsEnabled: true
  };
}

export function usePlayerState(
  initialTracks: TrackInit[],
  callbacks?: PlayerStateCallbacks,
  options: PlayerStateOptions = {}
) {
  const trackStates = ref<TrackState[]>(initialTracks.map(createTrackState));
  const playing = ref(false);
  const currentTime = ref(0);

  const anySoloed = computed(() => trackStates.value.some((t) => t.soloed && !t.failed));
  const gains = computed(() =>
    trackStates.value.map((t) => appliedGain(t, anySoloed.value, options.myPart?.value))
  );

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
  const referenceIndex = computed(() =>
    trackStates.value.findIndex((t) => t.isReady && !t.failed)
  );

  /**
   * The length the player shows and seeks within: the reference track's. The clock
   * follows that track, so a longer stem's tail could never actually be played.
   */
  const totalDuration = computed(
    () => trackStates.value[referenceIndex.value]?.duration ?? 0
  );

  const trackIdsWithLyricsEnabled = computed(() =>
    trackStates.value.filter((track) => track.lyricsEnabled).map((track) => track.id)
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
    if (trackIndex === referenceIndex.value || (gains.value[trackIndex] ?? 0) > 0) {
      playing.value = false;
    }
  };

  // --- Volume, mute and solo ---

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
    if (!track) return;
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

  const resetForNewSong = (newTracks: TrackInit[]) => {
    currentTime.value = 0;
    playing.value = false;
    trackStates.value = newTracks.map(createTrackState);
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
