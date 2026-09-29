import { describe, expect, it } from "vitest";

import type { LyricStanza } from "@/data/types";
import { addStatusToLyrics } from "@/utils/lyricsViewerUtils";

import {
  activeVerseKeys,
  copyColorsAndTracks,
  createEmptyLyrics,
  adjacentPosition,
  formatVerseTime,
  getVerseAt,
  listVersePositions,
  moveItemTo,
  nudgeTime,
  parseVerseTime,
  positionKey,
  pruneSelection,
  selectRange,
  setCommentInVerses,
  summarizeSelection,
  toggleColorInVerses,
  togglePosition,
  toggleTrackInVerses
} from "./lyricsSelection";

const lyrics = (): LyricStanza[] => [
  [
    { text: "uno", color_keys: ["sop"], start_time: 1, end_time: 2 },
    { text: "dos", color_keys: ["sop", "alt"], audio_track_ids: [12] },
    { text: "tres" }
  ],
  [
    [
      [{ text: "ay", color_keys: ["sop"] }],
      [{ text: "uh", color_keys: ["baj"] }, { text: "uh 2" }]
    ],
    { text: "cuatro", comment: "Coro" }
  ]
];

const p = (stanzaIndex: number, itemIndex: number, columnIndex?: number, lineIndex?: number) =>
  columnIndex === undefined ? { stanzaIndex, itemIndex } : { stanzaIndex, itemIndex, columnIndex, lineIndex };

describe("positions", () => {
  it("lists verses in reading order, columns left to right", () => {
    expect(listVersePositions(lyrics()).map(positionKey)).toEqual([
      "0-0",
      "0-1",
      "0-2",
      "1-0-0-0",
      "1-0-1-0",
      "1-0-1-1",
      "1-1"
    ]);
  });

  it("finds verses, including inside columns", () => {
    expect(getVerseAt(lyrics(), p(1, 0, 1, 1))?.text).toBe("uh 2");
    expect(getVerseAt(lyrics(), p(1, 0))).toBeNull();
    expect(getVerseAt(lyrics(), p(4, 0))).toBeNull();
  });

  it("selects a range in either direction", () => {
    expect(selectRange(lyrics(), p(0, 2), p(1, 0, 1, 0)).map(positionKey)).toEqual([
      "0-2",
      "1-0-0-0",
      "1-0-1-0"
    ]);
    expect(selectRange(lyrics(), p(1, 1), p(1, 0, 1, 1)).map(positionKey)).toEqual([
      "1-0-1-1",
      "1-1"
    ]);
  });

  it("toggles a position in and out of the selection", () => {
    const once = togglePosition([p(0, 0)], p(0, 2));
    expect(once.map(positionKey)).toEqual(["0-0", "0-2"]);
    expect(togglePosition(once, p(0, 0)).map(positionKey)).toEqual(["0-2"]);
  });

  it("moves to the adjacent verse across stanzas", () => {
    expect(positionKey(adjacentPosition(lyrics(), p(0, 2), "down")!)).toBe("1-0-0-0");
    expect(adjacentPosition(lyrics(), p(0, 0), "up")).toBeNull();
  });

  it("drops positions that no longer exist", () => {
    expect(pruneSelection(lyrics(), [p(0, 1), p(0, 9)]).map(positionKey)).toEqual(["0-1"]);
  });
});

describe("summarizeSelection", () => {
  it("reports what all, some or none of the verses have", () => {
    const summary = summarizeSelection(lyrics(), [p(0, 0), p(0, 1)], ["sop", "alt", "ten"], [12]);
    expect(summary.count).toBe(2);
    expect(summary.colors).toEqual({ sop: "all", alt: "some", ten: "none" });
    expect(summary.tracks).toEqual({ 12: "some" });
    expect(summary.comment).toEqual({ value: undefined, mixed: false });
  });

  it("marks differing comments as mixed", () => {
    const summary = summarizeSelection(lyrics(), [p(0, 0), p(1, 1)], [], []);
    expect(summary.comment.mixed).toBe(true);
  });
});

describe("applying to several verses", () => {
  it("adds a color to the verses missing it, keeping gradient order", () => {
    const next = toggleColorInVerses(lyrics(), [p(0, 0), p(0, 1), p(0, 2)], "alt");
    expect(next[0]![0]).toMatchObject({ color_keys: ["sop", "alt"] });
    expect(next[0]![1]).toMatchObject({ color_keys: ["sop", "alt"] });
    expect(next[0]![2]).toMatchObject({ color_keys: ["alt"] });
  });

  it("removes a color every selected verse has, and drops empty lists", () => {
    const next = toggleColorInVerses(lyrics(), [p(0, 0), p(1, 0, 0, 0)], "sop");
    expect(next[0]![0]).not.toHaveProperty("color_keys");
    expect(getVerseAt(next, p(1, 0, 0, 0))).not.toHaveProperty("color_keys");
    // untouched verse keeps its colors
    expect(next[0]![1]).toMatchObject({ color_keys: ["sop", "alt"] });
  });

  it("doesn't mutate the input", () => {
    const original = lyrics();
    toggleColorInVerses(original, [p(0, 2)], "sop");
    expect(original[0]![2]).not.toHaveProperty("color_keys");
  });

  it("toggles tracks with the same rule", () => {
    const added = toggleTrackInVerses(lyrics(), [p(0, 1), p(0, 2)], 12);
    expect(added[0]![2]).toMatchObject({ audio_track_ids: [12] });
    const removed = toggleTrackInVerses(added, [p(0, 1), p(0, 2)], 12);
    expect(removed[0]![1]).not.toHaveProperty("audio_track_ids");
    expect(removed[0]![2]).not.toHaveProperty("audio_track_ids");
  });

  it("sets and clears comments on all selected verses", () => {
    const set = setCommentInVerses(lyrics(), [p(0, 0), p(0, 1)], "Todos");
    expect(set[0]![0]).toMatchObject({ comment: "Todos" });
    expect(set[0]![1]).toMatchObject({ comment: "Todos" });
    const cleared = setCommentInVerses(set, [p(0, 0)], undefined);
    expect(cleared[0]![0]).not.toHaveProperty("comment");
  });
});

describe("times", () => {
  it("nudges by a step, rounded and never negative", () => {
    expect(nudgeTime(27, 0.1)).toBe(27.1);
    expect(nudgeTime(0.05, -0.1)).toBe(0);
    expect(nudgeTime(undefined, 0.1)).toBe(0.1);
  });

  it("formats minutes, seconds and hundredths", () => {
    expect(formatVerseTime(27.4)).toBe("0:27,40");
    expect(formatVerseTime(62.05)).toBe("1:02,05");
    expect(formatVerseTime(undefined)).toBeNull();
  });

  it("reads typed times in several shapes", () => {
    expect(parseVerseTime("0:27,40")).toBe(27.4);
    expect(parseVerseTime("1:02.5")).toBe(62.5);
    expect(parseVerseTime("27,4")).toBe(27.4);
    expect(parseVerseTime("  ")).toBeUndefined();
    expect(parseVerseTime("abc")).toBeNull();
    expect(parseVerseTime("1:75")).toBeNull();
  });

  it("finds the verses sounding at a time", () => {
    const keys = activeVerseKeys(addStatusToLyrics(lyrics(), 1.5));
    expect([...keys]).toEqual(["0-0"]);
  });
});

describe("moveItemTo", () => {
  it("moves a verse down within its stanza", () => {
    const result = moveItemTo(lyrics(), { stanzaIndex: 0, itemIndex: 0 }, { stanzaIndex: 0, itemIndex: 2 });
    expect(result!.lyrics[0]!.map((v) => (Array.isArray(v) ? "cols" : v.text))).toEqual([
      "dos",
      "uno",
      "tres"
    ]);
    expect(result!.position).toEqual({ stanzaIndex: 0, itemIndex: 1 });
  });

  it("moves a verse into another stanza, at the end", () => {
    const result = moveItemTo(lyrics(), { stanzaIndex: 0, itemIndex: 2 }, { stanzaIndex: 1, itemIndex: 2 });
    expect(result!.lyrics[0]).toHaveLength(2);
    expect(result!.lyrics[1]![2]).toMatchObject({ text: "tres" });
  });

  it("removes a stanza left empty and keeps the target index right", () => {
    const one: LyricStanza[] = [[{ text: "a" }], [{ text: "b" }, { text: "c" }]];
    const result = moveItemTo(one, { stanzaIndex: 0, itemIndex: 0 }, { stanzaIndex: 1, itemIndex: 1 });
    expect(result!.lyrics).toHaveLength(1);
    expect(result!.lyrics[0]!.map((v) => (v as { text: string }).text)).toEqual(["b", "a", "c"]);
    expect(result!.position).toEqual({ stanzaIndex: 0, itemIndex: 1 });
  });

  it("does nothing when dropped on itself", () => {
    expect(moveItemTo(lyrics(), { stanzaIndex: 0, itemIndex: 1 }, { stanzaIndex: 0, itemIndex: 1 })).toBeNull();
    expect(moveItemTo(lyrics(), { stanzaIndex: 0, itemIndex: 1 }, { stanzaIndex: 0, itemIndex: 2 })).toBeNull();
  });
});

describe("createEmptyLyrics", () => {
  it("returns a new, unshared empty verse every time", () => {
    const first = createEmptyLyrics();
    (first[0]![0] as { text: string }).text = "Hola";
    const second = createEmptyLyrics();
    expect(second).toEqual([[{ text: "", start_time: undefined, end_time: undefined }]]);
    expect(second[0]).not.toBe(first[0]);
  });
});

describe("copyColorsAndTracks", () => {
  const lyrics: LyricStanza[] = [
    [
      { text: "uno", color_keys: ["sop", "alt"], audio_track_ids: [1, 2], comment: "Coro" },
      { text: "dos", color_keys: ["ten"], start_time: 3 },
      { text: "tres", audio_track_ids: [9] }
    ]
  ];
  const at = (itemIndex: number) => ({ stanzaIndex: 0, itemIndex });

  it("gives every target the source's exact colors and tracks", () => {
    const next = copyColorsAndTracks(lyrics, at(0), [at(0), at(1), at(2)]);
    expect(next[0]![1]).toEqual({ text: "dos", color_keys: ["sop", "alt"], audio_track_ids: [1, 2], start_time: 3 });
    expect(next[0]![2]).toEqual({ text: "tres", color_keys: ["sop", "alt"], audio_track_ids: [1, 2] });
    expect(next[0]![0]).toEqual(lyrics[0]![0]);
  });

  it("clears colors and tracks when the source has none", () => {
    const next = copyColorsAndTracks(
      [[{ text: "a" }, { text: "b", color_keys: ["sop"], audio_track_ids: [1] }]],
      at(0),
      [at(1)]
    );
    expect(next[0]![1]).toEqual({ text: "b" });
  });

  it("doesn't mutate the input", () => {
    const before = JSON.stringify(lyrics);
    copyColorsAndTracks(lyrics, at(0), [at(1)]);
    expect(JSON.stringify(lyrics)).toBe(before);
  });
});
