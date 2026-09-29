import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import {
  appliedGain,
  DUCK_GAIN,
  type MyPartState,
  usePlayerState,
  type TrackInit
} from "./usePlayerState";

const threeTracks: TrackInit[] = [
  { id: 10, hasLyrics: true },
  { id: 20, hasLyrics: true },
  { id: 30, hasLyrics: false }
];

const twoTracks: TrackInit[] = [
  { id: 1, hasLyrics: true },
  { id: 2, hasLyrics: false }
];

const allReady = (state: ReturnType<typeof usePlayerState>, duration = 120) =>
  state.trackStates.value.forEach((_, i) => state.onReady(i, duration));

// --- Applied gain ---

describe("appliedGain", () => {
  const base = { id: 1, volume: 0.8, muted: false, soloed: false, failed: false };

  it.each([
    // [muted, soloed, anySoloed, expected]
    [false, false, false, 0.8],
    [true, false, false, 0],
    [false, false, true, 0],
    [false, true, true, 0.8],
    [true, true, true, 0]
  ])("muted=%s soloed=%s anySoloed=%s → %s", (muted, soloed, anySoloed, expected) => {
    expect(appliedGain({ ...base, muted, soloed }, anySoloed)).toBe(expected);
  });

  it("failed tracks are silent", () => {
    expect(appliedGain({ ...base, failed: true }, false)).toBe(0);
  });

  it("Mi parte ducks the other tracks by 6 dB only when asked", () => {
    const myPart: MyPartState = { trackIds: [2], duckOthers: true };
    expect(appliedGain(base, false, myPart)).toBeCloseTo(0.8 * DUCK_GAIN);
    expect(appliedGain({ ...base, id: 2 }, false, myPart)).toBe(0.8);
    expect(appliedGain(base, false, { ...myPart, duckOthers: false })).toBe(0.8);
    expect(appliedGain(base, false, { trackIds: [], duckOthers: true })).toBe(0.8);
  });
});

// --- Track ready / lifecycle ---

describe("track lifecycle", () => {
  it("onReady marks track as ready", () => {
    const { trackStates, onReady } = usePlayerState(threeTracks);
    onReady(1, 120);
    expect(trackStates.value[1]!.isReady).toBe(true);
    expect(trackStates.value[0]!.isReady).toBe(false);
  });

  it("isReady is false until ALL tracks are resolved", () => {
    const { isReady, onReady } = usePlayerState(threeTracks);
    expect(isReady.value).toBe(false);
    onReady(0, 120);
    onReady(1, 120);
    expect(isReady.value).toBe(false);
    onReady(2, 120);
    expect(isReady.value).toBe(true);
  });

  it("a failed track does not block playback", () => {
    const { isReady, onReady, onTrackError, gains } = usePlayerState(threeTracks);
    onReady(0, 120);
    onTrackError(1);
    onReady(2, 120);
    expect(isReady.value).toBe(true);
    expect(gains.value[1]).toBe(0);
  });

  it("is not ready when every track failed", () => {
    const { isReady, onTrackError } = usePlayerState(twoTracks);
    onTrackError(0);
    onTrackError(1);
    expect(isReady.value).toBe(false);
  });

  it("retrying a failed track makes it pending again", () => {
    const { trackStates, onTrackError, onTrackRetry } = usePlayerState(twoTracks);
    onTrackError(0);
    onTrackRetry(0);
    expect(trackStates.value[0]!.failed).toBe(false);
    expect(trackStates.value[0]!.isReady).toBe(false);
  });

  it("totalDuration is the longest loaded track", () => {
    const { totalDuration, onReady } = usePlayerState(threeTracks);
    onReady(0, 185.5);
    onReady(1, 190);
    expect(totalDuration.value).toBe(190);
  });

  it("the first loaded track drives the clock", () => {
    const state = usePlayerState(threeTracks);
    allReady(state);
    state.onTimeUpdate(0, 42.5);
    expect(state.currentTime.value).toBe(42.5);
    state.onTimeUpdate(1, 99);
    expect(state.currentTime.value).toBe(42.5);
  });

  it("when track 0 failed, the next loaded track drives the clock", () => {
    const { currentTime, onReady, onTrackError, onTimeUpdate } = usePlayerState(threeTracks);
    onTrackError(0);
    onReady(1, 120);
    onReady(2, 120);
    onTimeUpdate(0, 5);
    expect(currentTime.value).toBe(0);
    onTimeUpdate(1, 7);
    expect(currentTime.value).toBe(7);
  });
});

// --- Volume and mute ---

describe("volume and mute", () => {
  it("onVolumeChange clamps to [0, 1]", () => {
    const { trackStates, onVolumeChange } = usePlayerState(threeTracks);
    onVolumeChange(0, 1.5);
    expect(trackStates.value[0]!.volume).toBe(1);
    onVolumeChange(0, -0.5);
    expect(trackStates.value[0]!.volume).toBe(0);
  });

  it("mute is separate from volume and never resets it", () => {
    const { trackStates, gains, onVolumeChange, onToggleTrackMuted } = usePlayerState(threeTracks);
    onVolumeChange(0, 0.4);
    onToggleTrackMuted(0);
    expect(trackStates.value[0]!.muted).toBe(true);
    expect(trackStates.value[0]!.volume).toBe(0.4);
    expect(gains.value[0]).toBe(0);
    onToggleTrackMuted(0);
    expect(gains.value[0]).toBe(0.4);
  });

  it("unmute triggers onSeekTrack callback with current time (regression 2773ec3)", () => {
    const onSeekTrack = vi.fn();
    const state = usePlayerState(threeTracks, { onSeekTrack });
    allReady(state);
    state.onTimeUpdate(0, 30);
    state.onToggleTrackMuted(1);
    onSeekTrack.mockClear();

    state.onToggleTrackMuted(1);
    expect(onSeekTrack).toHaveBeenCalledWith(1, 30);
  });

  it("raising volume from 0 also triggers a seek", () => {
    const onSeekTrack = vi.fn();
    const state = usePlayerState(threeTracks, { onSeekTrack });
    state.onVolumeChange(1, 0);
    onSeekTrack.mockClear();
    state.onVolumeChange(1, 0.5);
    expect(onSeekTrack).toHaveBeenCalledWith(1, 0);
  });

  it("mute does NOT trigger seek callback", () => {
    const onSeekTrack = vi.fn();
    const { onToggleTrackMuted } = usePlayerState(threeTracks, { onSeekTrack });
    onToggleTrackMuted(0);
    expect(onSeekTrack).not.toHaveBeenCalled();
  });

  it("shift-mute syncs the track's lyrics to its mute state", () => {
    const { trackStates, onToggleTrackMuted } = usePlayerState(threeTracks);
    onToggleTrackMuted(0, true);
    expect(trackStates.value[0]!.lyricsEnabled).toBe(false);
    onToggleTrackMuted(0, true);
    expect(trackStates.value[0]!.lyricsEnabled).toBe(true);
  });

  it("plain mute does not affect lyrics", () => {
    const { trackStates, onToggleTrackMuted } = usePlayerState(threeTracks);
    onToggleTrackMuted(0);
    expect(trackStates.value[0]!.lyricsEnabled).toBe(true);
  });
});

// --- Solo ---

describe("solo", () => {
  it("solo silences the other tracks without touching their volume", () => {
    const { trackStates, gains, onSoloTrack, onVolumeChange } = usePlayerState(threeTracks);
    onVolumeChange(0, 0.3);
    onSoloTrack(1);
    expect(gains.value).toEqual([0, 1, 0]);
    expect(trackStates.value[0]!.volume).toBe(0.3);
    onSoloTrack(1);
    expect(gains.value).toEqual([0.3, 1, 1]);
  });

  it("several tracks can be soloed at once", () => {
    const { gains, onSoloTrack } = usePlayerState(threeTracks);
    onSoloTrack(0);
    onSoloTrack(2);
    expect(gains.value).toEqual([1, 0, 1]);
  });

  it("a muted track stays silent even when soloed", () => {
    const { gains, onSoloTrack, onToggleTrackMuted } = usePlayerState(threeTracks);
    onToggleTrackMuted(1);
    onSoloTrack(1);
    expect(gains.value).toEqual([0, 0, 0]);
  });

  it("solo triggers a seek for tracks that become audible", () => {
    const onSeekTrack = vi.fn();
    const state = usePlayerState(threeTracks, { onSeekTrack });
    allReady(state);
    state.onSoloTrack(0);
    state.onTimeUpdate(0, 50);
    onSeekTrack.mockClear();

    state.onSoloTrack(1); // tracks 0 and 1 soloed: 1 becomes audible
    expect(onSeekTrack).toHaveBeenCalledWith(1, 50);
    expect(onSeekTrack).toHaveBeenCalledTimes(1);
  });

  it("solo with toggleLyrics shows only the soloed tracks' lyrics", () => {
    const { trackStates, onSoloTrack } = usePlayerState(threeTracks);
    onSoloTrack(1, true);
    expect(trackStates.value.map((t) => t.lyricsEnabled)).toEqual([false, true, false]);
    onSoloTrack(1, true);
    expect(trackStates.value.every((t) => t.lyricsEnabled)).toBe(true);
  });
});

// --- Mi parte ---

describe("Mi parte", () => {
  it("feeds the applied gain reactively", () => {
    const myPart = ref<MyPartState | null>(null);
    const { gains } = usePlayerState(threeTracks, undefined, { myPart });
    expect(gains.value).toEqual([1, 1, 1]);
    myPart.value = { trackIds: [20], duckOthers: true };
    expect(gains.value).toEqual([DUCK_GAIN, 1, DUCK_GAIN]);
  });
});

// --- Finish ---

describe("finish", () => {
  it("the reference track finishing stops playback", () => {
    const state = usePlayerState(threeTracks);
    allReady(state);
    state.playing.value = true;
    state.onFinish(0);
    expect(state.playing.value).toBe(false);
  });

  it("a silent non-reference track finishing does NOT stop playback", () => {
    const state = usePlayerState(threeTracks);
    allReady(state);
    state.playing.value = true;
    state.onToggleTrackMuted(1);
    state.onFinish(1);
    expect(state.playing.value).toBe(true);
  });
});

// --- Lyrics visibility ---

describe("lyrics visibility", () => {
  it("onToggleTrackLyrics flips lyricsEnabled by track ID", () => {
    const { trackStates, onToggleTrackLyrics } = usePlayerState(threeTracks);
    onToggleTrackLyrics(10);
    expect(trackStates.value[0]!.lyricsEnabled).toBe(false);
    onToggleTrackLyrics(10);
    expect(trackStates.value[0]!.lyricsEnabled).toBe(true);
  });

  it("onSoloTrackLyrics disables all others, enables target", () => {
    const { trackStates, onSoloTrackLyrics } = usePlayerState(threeTracks);
    onSoloTrackLyrics(20);
    expect(trackStates.value.map((t) => t.lyricsEnabled)).toEqual([false, true, false]);
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
    const state = usePlayerState(threeTracks);
    state.playing.value = true;
    allReady(state, 200);
    state.onTimeUpdate(0, 50);
    state.onToggleTrackMuted(1);
    state.onSoloTrack(0);

    state.resetForNewSong(twoTracks);

    expect(state.playing.value).toBe(false);
    expect(state.currentTime.value).toBe(0);
    expect(state.totalDuration.value).toBe(0);
    expect(state.trackStates.value.length).toBe(2);
    expect(state.trackStates.value[0]).toMatchObject({
      volume: 1,
      muted: false,
      soloed: false,
      isReady: false
    });
  });
});

// --- Edge cases ---

describe("edge cases", () => {
  it("operations on out-of-bounds track index are safe", () => {
    const state = usePlayerState(threeTracks);
    expect(() => state.onVolumeChange(99, 0.5)).not.toThrow();
    expect(() => state.onReady(99, 100)).not.toThrow();
    expect(() => state.onFinish(99)).not.toThrow();
    expect(() => state.onToggleTrackMuted(99)).not.toThrow();
    expect(() => state.onSoloTrack(99)).not.toThrow();
    expect(() => state.onTrackError(99)).not.toThrow();
  });
});
