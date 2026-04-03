import { computed, ref } from "vue";

export type TrackInit = {
  id: number;
  hasLyrics: boolean;
};

export type TrackState = {
  id: number;
  isReady: boolean;
  volume: number;
  hasLyrics: boolean;
  lyricsEnabled: boolean;
};

export type PlayerStateCallbacks = {
  onSeekTrack?: (trackIndex: number, time: number) => void;
};

function createTrackState(init: TrackInit): TrackState {
  return {
    id: init.id,
    isReady: false,
    volume: 1,
    hasLyrics: init.hasLyrics,
    lyricsEnabled: true
  };
}

export function usePlayerState(initialTracks: TrackInit[], callbacks?: PlayerStateCallbacks) {
  const trackStates = ref<TrackState[]>(initialTracks.map(createTrackState));
  const playing = ref(false);
  const currentTime = ref(0);
  const totalDuration = ref(0);

  const isReady = computed(() => trackStates.value.every((track) => track.isReady));
  const trackIdsWithLyricsEnabled = computed(() =>
    trackStates.value.filter((track) => track.lyricsEnabled).map((track) => track.id)
  );

  // --- Track lifecycle ---

  const onReady = (trackIndex: number, duration: number) => {
    if (!trackStates.value[trackIndex]) return;
    trackStates.value[trackIndex].isReady = true;
    if (trackIndex === 0) {
      totalDuration.value = duration;
    }
  };

  const onTimeUpdate = (trackIndex: number, time: number) => {
    if (trackIndex === 0) {
      currentTime.value = time;
    }
  };

  const onFinish = (trackIndex: number) => {
    const trackVolume = trackStates.value[trackIndex]?.volume ?? 0;
    if (trackVolume > 0) {
      playing.value = false;
    }
  };

  // --- Volume / mute ---

  const setTrackLyricsEnabled = (trackId: number, enabled: boolean) => {
    const idx = trackStates.value.findIndex((t) => t.id === trackId);
    if (idx === -1) return;
    trackStates.value[idx]!.lyricsEnabled = enabled;
  };

  const onVolumeChange = (trackIndex: number, volume: number, toggleLyrics = false) => {
    if (!trackStates.value[trackIndex]) return;
    const previousVolume = trackStates.value[trackIndex].volume;
    const clampedVolume = Math.max(0, Math.min(1, volume));
    trackStates.value[trackIndex].volume = clampedVolume;

    // When unmuting, signal that the track needs to seek to current time
    if (previousVolume === 0 && clampedVolume > 0) {
      callbacks?.onSeekTrack?.(trackIndex, currentTime.value);
    }

    if (toggleLyrics) {
      const trackId = trackStates.value[trackIndex].id;
      setTrackLyricsEnabled(trackId, clampedVolume > 0);
    }
  };

  const onToggleTrackMuted = (trackIndex: number, toggleLyrics: boolean) => {
    if (!trackStates.value[trackIndex]) return;
    const shouldBeEnabled = trackStates.value[trackIndex].volume === 0;
    const newVolume = shouldBeEnabled ? 1 : 0;
    onVolumeChange(trackIndex, newVolume, toggleLyrics);
  };

  const onSoloTrack = (trackIndex: number, toggleLyrics: boolean) => {
    const isCurrentlySoloed = trackStates.value.every(
      (track, i) => i === trackIndex || track.volume === 0
    );

    trackStates.value.forEach((_, i) => {
      const shouldBeEnabled = i === trackIndex || isCurrentlySoloed;
      const newVolume = shouldBeEnabled ? 1 : 0;
      onVolumeChange(i, newVolume, toggleLyrics);
    });
  };

  // --- Lyrics visibility ---

  const onToggleTrackLyrics = (trackId: number) => {
    const idx = trackStates.value.findIndex((t) => t.id === trackId);
    if (idx === -1) return;
    setTrackLyricsEnabled(trackId, !trackStates.value[idx]!.lyricsEnabled);
  };

  const onSoloTrackLyrics = (trackId: number) => {
    const trackIndex = trackStates.value.findIndex((t) => t.id === trackId);
    if (trackIndex === -1) return;

    const isCurrentlySoloed = trackStates.value.every(
      (track, i) => i === trackIndex || !track.lyricsEnabled
    );

    trackStates.value.forEach((track) => {
      setTrackLyricsEnabled(
        track.id,
        track.id === trackId || isCurrentlySoloed
      );
    });
  };

  // --- Song change ---

  const resetForNewSong = (newTracks: TrackInit[]) => {
    currentTime.value = 0;
    totalDuration.value = 0;
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
    trackIdsWithLyricsEnabled,

    // Track lifecycle
    onReady,
    onTimeUpdate,
    onFinish,

    // Volume/mute
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
