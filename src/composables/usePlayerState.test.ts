import { describe, expect, it, vi } from "vitest";

import { usePlayerState, type TrackInit } from "./usePlayerState";

const threeTracks: TrackInit[] = [
  { id: 10, hasLyrics: true },
  { id: 20, hasLyrics: true },
  { id: 30, hasLyrics: false }
];

const twoTracks: TrackInit[] = [
  { id: 1, hasLyrics: true },
  { id: 2, hasLyrics: false }
];

// --- Track ready / lifecycle ---

describe("track lifecycle", () => {
  it("onReady marks track as ready", () => {
    const { trackStates, onReady } = usePlayerState(threeTracks);
    onReady(1, 120);
    expect(trackStates.value[1].isReady).toBe(true);
    expect(trackStates.value[0].isReady).toBe(false);
  });

  it("isReady is false until ALL tracks are ready", () => {
    const { isReady, onReady } = usePlayerState(threeTracks);
    expect(isReady.value).toBe(false);
    onReady(0, 120);
    onReady(1, 120);
    expect(isReady.value).toBe(false);
    onReady(2, 120);
    expect(isReady.value).toBe(true);
  });

  it("onReady on track 0 sets totalDuration", () => {
    const { totalDuration, onReady } = usePlayerState(threeTracks);
    onReady(0, 185.5);
    expect(totalDuration.value).toBe(185.5);
  });

  it("onTimeUpdate on track 0 updates currentTime, other tracks ignored", () => {
    const { currentTime, onTimeUpdate } = usePlayerState(threeTracks);
    onTimeUpdate(0, 42.5);
    expect(currentTime.value).toBe(42.5);
    onTimeUpdate(1, 99);
    expect(currentTime.value).toBe(42.5);
  });
});

// --- Volume and mute ---

describe("volume and mute", () => {
  it("onVolumeChange clamps to [0, 1]", () => {
    const { trackStates, onVolumeChange } = usePlayerState(threeTracks);
    onVolumeChange(0, 1.5);
    expect(trackStates.value[0].volume).toBe(1);
    onVolumeChange(0, -0.5);
    expect(trackStates.value[0].volume).toBe(0);
  });

  it("onToggleTrackMuted toggles volume between 0 and 1", () => {
    const { trackStates, onToggleTrackMuted } = usePlayerState(threeTracks);
    expect(trackStates.value[0].volume).toBe(1);
    onToggleTrackMuted(0, false);
    expect(trackStates.value[0].volume).toBe(0);
    onToggleTrackMuted(0, false);
    expect(trackStates.value[0].volume).toBe(1);
  });

  it("unmute triggers onSeekTrack callback with current time (regression 2773ec3)", () => {
    const onSeekTrack = vi.fn();
    const { onVolumeChange, onTimeUpdate } = usePlayerState(threeTracks, { onSeekTrack });

    // Set current time and mute track
    onTimeUpdate(0, 30);
    onVolumeChange(1, 0);
    onSeekTrack.mockClear();

    // Unmute — should trigger seek
    onVolumeChange(1, 1);
    expect(onSeekTrack).toHaveBeenCalledWith(1, 30);
  });

  it("mute does NOT trigger seek callback", () => {
    const onSeekTrack = vi.fn();
    const { onVolumeChange } = usePlayerState(threeTracks, { onSeekTrack });

    onVolumeChange(0, 0); // mute
    expect(onSeekTrack).not.toHaveBeenCalled();
  });

  it("onVolumeChange with toggleLyrics=true syncs lyrics to volume state", () => {
    const { trackStates, onVolumeChange } = usePlayerState(threeTracks);
    expect(trackStates.value[0].lyricsEnabled).toBe(true);

    onVolumeChange(0, 0, true); // mute with lyrics sync
    expect(trackStates.value[0].lyricsEnabled).toBe(false);

    onVolumeChange(0, 1, true); // unmute with lyrics sync
    expect(trackStates.value[0].lyricsEnabled).toBe(true);
  });

  it("onVolumeChange without toggleLyrics does not affect lyrics", () => {
    const { trackStates, onVolumeChange } = usePlayerState(threeTracks);
    onVolumeChange(0, 0, false);
    expect(trackStates.value[0].lyricsEnabled).toBe(true); // unchanged
  });
});

// --- Solo ---

describe("solo", () => {
  it("solo mutes all other tracks", () => {
    const { trackStates, onSoloTrack } = usePlayerState(threeTracks);
    onSoloTrack(1, false);
    expect(trackStates.value[0].volume).toBe(0);
    expect(trackStates.value[1].volume).toBe(1);
    expect(trackStates.value[2].volume).toBe(0);
  });

  it("solo on already-soloed track unmutes everyone", () => {
    const { trackStates, onSoloTrack } = usePlayerState(threeTracks);
    onSoloTrack(1, false); // solo track 1
    onSoloTrack(1, false); // un-solo
    expect(trackStates.value[0].volume).toBe(1);
    expect(trackStates.value[1].volume).toBe(1);
    expect(trackStates.value[2].volume).toBe(1);
  });

  it("solo triggers seek callback for each unmuted track", () => {
    const onSeekTrack = vi.fn();
    const { onSoloTrack, onVolumeChange, onTimeUpdate } = usePlayerState(threeTracks, { onSeekTrack });

    // Mute all tracks first
    onVolumeChange(0, 0);
    onVolumeChange(1, 0);
    onVolumeChange(2, 0);
    onTimeUpdate(0, 50);
    onSeekTrack.mockClear();

    // Solo track 1 — track 1 unmutes (0→1), so seek should fire for it
    onSoloTrack(1, false);
    expect(onSeekTrack).toHaveBeenCalledWith(1, 50);
  });

  it("solo with toggleLyrics also solos lyrics", () => {
    const { trackStates, onSoloTrack } = usePlayerState(threeTracks);
    onSoloTrack(1, true);
    expect(trackStates.value[0].lyricsEnabled).toBe(false);
    expect(trackStates.value[1].lyricsEnabled).toBe(true);
    expect(trackStates.value[2].lyricsEnabled).toBe(false);
  });
});

// --- Finish ---

describe("finish", () => {
  it("onFinish on audible track stops playback", () => {
    const { playing, onFinish } = usePlayerState(threeTracks);
    playing.value = true;
    onFinish(0); // volume is 1 (audible)
    expect(playing.value).toBe(false);
  });

  it("onFinish on muted track does NOT stop playback", () => {
    const { playing, onFinish, onVolumeChange } = usePlayerState(threeTracks);
    playing.value = true;
    onVolumeChange(1, 0); // mute track 1
    onFinish(1);
    expect(playing.value).toBe(true);
  });

  it("onFinish when already not playing is a no-op", () => {
    const { playing, onFinish } = usePlayerState(threeTracks);
    playing.value = false;
    onFinish(0);
    expect(playing.value).toBe(false);
  });
});

// --- Lyrics visibility ---

describe("lyrics visibility", () => {
  it("onToggleTrackLyrics flips lyricsEnabled by track ID", () => {
    const { trackStates, onToggleTrackLyrics } = usePlayerState(threeTracks);
    expect(trackStates.value[0].lyricsEnabled).toBe(true);
    onToggleTrackLyrics(10); // track ID 10 is index 0
    expect(trackStates.value[0].lyricsEnabled).toBe(false);
    onToggleTrackLyrics(10);
    expect(trackStates.value[0].lyricsEnabled).toBe(true);
  });

  it("onSoloTrackLyrics disables all others, enables target", () => {
    const { trackStates, onSoloTrackLyrics } = usePlayerState(threeTracks);
    onSoloTrackLyrics(20); // solo lyrics for track ID 20
    expect(trackStates.value[0].lyricsEnabled).toBe(false);
    expect(trackStates.value[1].lyricsEnabled).toBe(true);
    expect(trackStates.value[2].lyricsEnabled).toBe(false);
  });

  it("onSoloTrackLyrics on already-soloed track re-enables all", () => {
    const { trackStates, onSoloTrackLyrics } = usePlayerState(threeTracks);
    onSoloTrackLyrics(20);
    onSoloTrackLyrics(20);
    expect(trackStates.value.every((t) => t.lyricsEnabled)).toBe(true);
  });

  it("trackIdsWithLyricsEnabled reflects current state", () => {
    const { trackIdsWithLyricsEnabled, onToggleTrackLyrics } = usePlayerState(threeTracks);
    expect(trackIdsWithLyricsEnabled.value).toEqual([10, 20, 30]);
    onToggleTrackLyrics(20);
    expect(trackIdsWithLyricsEnabled.value).toEqual([10, 30]);
  });
});

// --- Song reset ---

describe("song reset", () => {
  it("resetForNewSong resets all state", () => {
    const { trackStates, playing, currentTime, totalDuration, onReady, onTimeUpdate, onVolumeChange, resetForNewSong } =
      usePlayerState(threeTracks);

    // Mutate state
    playing.value = true;
    onTimeUpdate(0, 50);
    onReady(0, 200);
    onVolumeChange(1, 0);

    resetForNewSong(twoTracks);

    expect(playing.value).toBe(false);
    expect(currentTime.value).toBe(0);
    expect(totalDuration.value).toBe(0);
    expect(trackStates.value.length).toBe(2);
    expect(trackStates.value[0].volume).toBe(1);
    expect(trackStates.value[0].isReady).toBe(false);
  });

  it("resetForNewSong with new track list replaces trackStates", () => {
    const { trackStates, resetForNewSong } = usePlayerState(threeTracks);
    expect(trackStates.value.length).toBe(3);

    const newTracks: TrackInit[] = [{ id: 99, hasLyrics: false }];
    resetForNewSong(newTracks);
    expect(trackStates.value.length).toBe(1);
    expect(trackStates.value[0].id).toBe(99);
  });
});

// --- Edge cases ---

describe("edge cases", () => {
  it("operations on out-of-bounds track index are safe", () => {
    const { onVolumeChange, onReady, onFinish, onToggleTrackMuted } = usePlayerState(threeTracks);
    // None of these should throw
    expect(() => onVolumeChange(99, 0.5)).not.toThrow();
    expect(() => onReady(99, 100)).not.toThrow();
    expect(() => onFinish(99)).not.toThrow();
    expect(() => onToggleTrackMuted(99, false)).not.toThrow();
  });

  it("volume change on single-track song", () => {
    const { trackStates, onToggleTrackMuted } = usePlayerState([{ id: 1, hasLyrics: false }]);
    onToggleTrackMuted(0, false);
    expect(trackStates.value[0].volume).toBe(0);
    onToggleTrackMuted(0, false);
    expect(trackStates.value[0].volume).toBe(1);
  });

  it("solo on two-track song", () => {
    const { trackStates, onSoloTrack } = usePlayerState(twoTracks);
    onSoloTrack(0, false);
    expect(trackStates.value[0].volume).toBe(1);
    expect(trackStates.value[1].volume).toBe(0);

    // Un-solo
    onSoloTrack(0, false);
    expect(trackStates.value[0].volume).toBe(1);
    expect(trackStates.value[1].volume).toBe(1);
  });
});
