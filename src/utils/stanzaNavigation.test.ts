import { describe, expect, it } from "vitest";

import type { LyricStanza } from "@/data/types";

import { nextStanzaTime, previousStanzaTime, stanzaStartTimes } from "./stanzaNavigation";

const lyrics: LyricStanza[] = [
  [{ text: "a", start_time: 12.4 }, { text: "b", start_time: 15.9 }],
  [
    { text: "coro", start_time: 27 },
    [[{ text: "col 1", start_time: 33.4 }], [{ text: "col 2", start_time: 33.4 }]]
  ],
  [{ text: "sin tiempo" }],
  [[[{ text: "solo columnas", start_time: 40 }], [{ text: "otra", start_time: 36 }]]]
];

describe("stanzaStartTimes", () => {
  it("takes the earliest start of each timed stanza, including columns", () => {
    expect(stanzaStartTimes(lyrics)).toEqual([12.4, 27, 36]);
  });

  it("is empty without times", () => {
    expect(stanzaStartTimes([[{ text: "x" }]])).toEqual([]);
  });
});

describe("previous / next stanza", () => {
  const starts = [12.4, 27, 36];

  it("goes to the next stanza start", () => {
    expect(nextStanzaTime(starts, 20)).toBe(27);
    expect(nextStanzaTime(starts, 27)).toBe(36);
    expect(nextStanzaTime(starts, 40)).toBeNull();
  });

  it("goes to the start of the current stanza, or the previous one right after it starts", () => {
    expect(previousStanzaTime(starts, 30)).toBe(27);
    expect(previousStanzaTime(starts, 27.5)).toBe(12.4);
    expect(previousStanzaTime(starts, 5)).toBe(0);
  });
});
