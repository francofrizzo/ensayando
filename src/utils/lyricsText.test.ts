import { describe, expect, it } from "vitest";

import type { LyricStanza } from "@/data/types";

import { lyricsToText, textToLyrics } from "./lyricsText";

describe("textToLyrics", () => {
  it("splits stanzas on blank lines and verses on lines", () => {
    expect(textToLyrics("Uno\nDos\n\nTres")).toEqual([[{ text: "Uno" }, { text: "Dos" }], [{ text: "Tres" }]]);
  });

  it("trims lines, ignores extra blank lines and Windows line endings", () => {
    expect(textToLyrics("\r\n  Uno  \r\n\r\n\r\n\r\nDos\r\n")).toEqual([[{ text: "Uno" }], [{ text: "Dos" }]]);
  });

  it("treats blank lines with spaces as stanza breaks", () => {
    expect(textToLyrics("Uno\n   \nDos")).toHaveLength(2);
  });

  it("turns a bracketed line into the comment of the next verse", () => {
    expect(textToLyrics("[Coro]\nVidala, vidala\nque el viento")).toEqual([
      [{ text: "Vidala, vidala", comment: "Coro" }, { text: "que el viento" }]
    ]);
  });

  it("turns ' / ' into columns", () => {
    expect(textToLyrics("Ay, vidala / (uh, uh)")).toEqual([[[[{ text: "Ay, vidala" }], [{ text: "(uh, uh)" }]]]]);
  });

  it("returns nothing for empty text", () => {
    expect(textToLyrics("  \n\n ")).toEqual([]);
  });
});

describe("lyricsToText", () => {
  const lyrics: LyricStanza[] = [
    [
      { text: "Sopla el viento", comment: "Todos", color_keys: ["sop"], start_time: 1 },
      { text: "y se lleva mi canción" }
    ],
    [
      { text: "Vidala, vidala" },
      [[{ text: "Ay, vidala" }, { text: "ay" }], [{ text: "(uh, uh)" }]]
    ]
  ];

  it("writes stanzas, comments and column rows", () => {
    expect(lyricsToText(lyrics)).toBe(
      "[Todos]\nSopla el viento\ny se lleva mi canción\n\nVidala, vidala\nAy, vidala / (uh, uh)\nay"
    );
  });

  it("round-trips the text (colors and times aside)", () => {
    const text = lyricsToText(lyrics);
    expect(lyricsToText(textToLyrics(text))).toBe(text);
  });
});
