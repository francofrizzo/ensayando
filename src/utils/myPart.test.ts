import { describe, expect, it } from "vitest";

import { EMPTY_MY_PART, isVerseDimmed, myPartForSong, parseMyPart } from "./myPart";

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
