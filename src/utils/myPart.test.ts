import { describe, expect, it } from "vitest";

import {
  EMPTY_MY_PART,
  isVerseDimmed,
  lowerRestVolumes,
  myPartForSong,
  parseMyPart
} from "./myPart";

describe("parseMyPart", () => {
  it("reads a stored value", () => {
    expect(parseMyPart('{"trackIds":[3,5],"duckOthers":true}')).toEqual({
      trackIds: [3, 5],
      duckOthers: true
    });
  });

  it("falls back to empty on missing or broken values", () => {
    expect(parseMyPart(null)).toEqual(EMPTY_MY_PART);
    expect(parseMyPart("{nope")).toEqual(EMPTY_MY_PART);
    expect(parseMyPart('{"trackIds":["a",2]}')).toEqual({ trackIds: [2], duckOthers: false });
  });
});

describe("myPartForSong", () => {
  it("drops tracks the song doesn't have", () => {
    expect(myPartForSong({ trackIds: [1, 9], duckOthers: true }, [1, 2])).toEqual({
      trackIds: [1],
      duckOthers: true
    });
  });
});

describe("isVerseDimmed", () => {
  const part = { trackIds: [2], duckOthers: false };

  it("dims verses that belong only to other tracks", () => {
    expect(isVerseDimmed({ audio_track_ids: [1] }, part)).toBe(true);
    expect(isVerseDimmed({ audio_track_ids: [1, 2] }, part)).toBe(false);
  });

  it("never dims verses without tracks, or when Mi parte is empty", () => {
    expect(isVerseDimmed({}, part)).toBe(false);
    expect(isVerseDimmed({ audio_track_ids: [1] }, EMPTY_MY_PART)).toBe(false);
  });
});

describe("lowerRestVolumes", () => {
  const tracks = [
    { id: 1, volume: 1 },
    { id: 2, volume: 0.8 },
    { id: 3, volume: 0.6 }
  ];

  it("halves the tracks outside Mi parte and remembers their volume", () => {
    const { changes, saved } = lowerRestVolumes(tracks, { trackIds: [1], duckOthers: true }, {});
    expect(changes).toEqual({ 2: 0.4, 3: 0.3 });
    expect(saved).toEqual({ 2: 0.8, 3: 0.6 });
  });

  it("does nothing while Mi parte is empty or the option is off", () => {
    expect(lowerRestVolumes(tracks, { trackIds: [], duckOthers: true }, {}).changes).toEqual({});
    expect(lowerRestVolumes(tracks, { trackIds: [1], duckOthers: false }, {}).changes).toEqual({});
  });

  it("puts volumes back when turned off, unless the slider was moved meanwhile", () => {
    const lowered = [
      { id: 1, volume: 1 },
      { id: 2, volume: 0.4 },
      { id: 3, volume: 0.9 }
    ];
    const { changes, saved } = lowerRestVolumes(
      lowered,
      { trackIds: [1], duckOthers: false },
      { 2: 0.8, 3: 0.6 }
    );
    expect(changes).toEqual({ 2: 0.8 });
    expect(saved).toEqual({});
  });

  it("doesn't lower a track twice", () => {
    const part = { trackIds: [1], duckOthers: true };
    const first = lowerRestVolumes(tracks, part, {});
    const again = lowerRestVolumes(
      tracks.map((t) => ({ ...t, volume: first.changes[t.id] ?? t.volume })),
      part,
      first.saved
    );
    expect(again.changes).toEqual({});
  });
});
