import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import type { LyricStanza, LyricVerse } from "@/data/types";
import { useLyricsOperations } from "@/composables/useLyricsOperations";
import { calculatePositionAfterDeletion, type FocusPosition } from "@/utils/lyricsPositionUtils";

function setup(initialLyrics: LyricStanza[]) {
  const lyrics = ref<LyricStanza[]>(structuredClone(initialLyrics));
  const updateLyrics = vi.fn((newLyrics: LyricStanza[]) => {
    lyrics.value = newLyrics;
  });
  const focusInput = vi.fn(async (_pos: FocusPosition) => {});
  const findPositionAfterDeletion = (pos: FocusPosition) =>
    calculatePositionAfterDeletion(pos, lyrics.value);

  const ops = useLyricsOperations(lyrics, updateLyrics, focusInput, findPositionAfterDeletion);
  return { lyrics, updateLyrics, focusInput, ops };
}

const verse = (text: string): LyricVerse => ({ text });

// --- insertLine ---

describe("insertLine", () => {
  it("inserts a verse after the current position", () => {
    const { lyrics, ops } = setup([[verse("A"), verse("B")]]);
    ops.insertLine({ stanzaIndex: 0, itemIndex: 0 }, false);
    expect(lyrics.value[0].length).toBe(3);
    expect((lyrics.value[0][1] as LyricVerse).text).toBe("");
  });

  it("inserts a verse before the current position", () => {
    const { lyrics, ops } = setup([[verse("A"), verse("B")]]);
    ops.insertLine({ stanzaIndex: 0, itemIndex: 1 }, true);
    expect(lyrics.value[0].length).toBe(3);
    expect((lyrics.value[0][1] as LyricVerse).text).toBe("");
    expect((lyrics.value[0][2] as LyricVerse).text).toBe("B");
  });

  it("inserts within a column", () => {
    const columns: LyricVerse[][] = [[verse("C1")], [verse("C2")]];
    const { lyrics, ops } = setup([[columns]]);
    ops.insertLine({ stanzaIndex: 0, itemIndex: 0, columnIndex: 0, lineIndex: 0 }, false);
    const col = (lyrics.value[0][0] as LyricVerse[][])[0];
    expect(col.length).toBe(2);
    expect(col[1].text).toBe("");
  });
});

// --- deleteLine ---

describe("deleteLine", () => {
  it("deletes a regular verse", () => {
    const { lyrics, ops } = setup([[verse("A"), verse("B"), verse("C")]]);
    ops.deleteLine({ stanzaIndex: 0, itemIndex: 1 });
    expect(lyrics.value[0].length).toBe(2);
    expect((lyrics.value[0][0] as LyricVerse).text).toBe("A");
    expect((lyrics.value[0][1] as LyricVerse).text).toBe("C");
  });

  it("removes stanza when last verse is deleted", () => {
    const { lyrics, ops } = setup([[verse("A")], [verse("B")]]);
    ops.deleteLine({ stanzaIndex: 0, itemIndex: 0 });
    expect(lyrics.value.length).toBe(1);
    expect((lyrics.value[0][0] as LyricVerse).text).toBe("B");
  });

  it("deletes a line within a column", () => {
    const columns: LyricVerse[][] = [[verse("C1L1"), verse("C1L2")], [verse("C2L1")]];
    const { lyrics, ops } = setup([[columns]]);
    ops.deleteLine({ stanzaIndex: 0, itemIndex: 0, columnIndex: 0, lineIndex: 0 });
    const col = (lyrics.value[0][0] as LyricVerse[][])[0];
    expect(col.length).toBe(1);
    expect(col[0].text).toBe("C1L2");
  });

  it("removes column when its last line is deleted", () => {
    const columns: LyricVerse[][] = [[verse("C1")], [verse("C2")]];
    const { lyrics, ops } = setup([[columns]]);
    ops.deleteLine({ stanzaIndex: 0, itemIndex: 0, columnIndex: 0, lineIndex: 0 });
    // Column 0 is gone. Since only 1 column with 1 verse remains, it collapses to a regular verse.
    expect(Array.isArray(lyrics.value[0][0])).toBe(false);
    expect((lyrics.value[0][0] as LyricVerse).text).toBe("C2");
  });
});

// --- convertToColumns ---

describe("convertToColumns", () => {
  it("converts a regular verse to a 2-column layout", () => {
    const { lyrics, ops } = setup([[verse("Solo")]]);
    ops.convertToColumns({ stanzaIndex: 0, itemIndex: 0 });
    const item = lyrics.value[0][0];
    expect(Array.isArray(item)).toBe(true);
    const columns = item as LyricVerse[][];
    expect(columns.length).toBe(2);
    expect(columns[0][0].text).toBe("Solo");
    expect(columns[1][0].text).toBe("");
  });

  it("does nothing if item is already columns", () => {
    const columns: LyricVerse[][] = [[verse("A")], [verse("B")]];
    const { lyrics, updateLyrics, ops } = setup([[columns]]);
    ops.convertToColumns({ stanzaIndex: 0, itemIndex: 0 });
    expect(updateLyrics).not.toHaveBeenCalled();
  });
});

// --- moveLine ---

describe("moveLine", () => {
  it("moves a verse down", () => {
    const { lyrics, ops } = setup([[verse("A"), verse("B"), verse("C")]]);
    ops.moveLine({ stanzaIndex: 0, itemIndex: 0 }, "down");
    expect((lyrics.value[0][0] as LyricVerse).text).toBe("B");
    expect((lyrics.value[0][1] as LyricVerse).text).toBe("A");
  });

  it("moves a verse up", () => {
    const { lyrics, ops } = setup([[verse("A"), verse("B"), verse("C")]]);
    ops.moveLine({ stanzaIndex: 0, itemIndex: 2 }, "up");
    expect((lyrics.value[0][1] as LyricVerse).text).toBe("C");
    expect((lyrics.value[0][2] as LyricVerse).text).toBe("B");
  });

  it("does nothing when moving first verse up", () => {
    const { updateLyrics, ops } = setup([[verse("A"), verse("B")]]);
    ops.moveLine({ stanzaIndex: 0, itemIndex: 0 }, "up");
    expect(updateLyrics).not.toHaveBeenCalled();
  });

  it("does nothing when moving last verse down", () => {
    const { updateLyrics, ops } = setup([[verse("A"), verse("B")]]);
    ops.moveLine({ stanzaIndex: 0, itemIndex: 1 }, "down");
    expect(updateLyrics).not.toHaveBeenCalled();
  });
});

// --- insertStanza ---

describe("insertStanza", () => {
  it("inserts a new stanza after the current one", () => {
    const { lyrics, ops } = setup([[verse("S1")]]);
    ops.insertStanza({ stanzaIndex: 0, itemIndex: 0 });
    expect(lyrics.value.length).toBe(2);
    expect((lyrics.value[1][0] as LyricVerse).text).toBe("");
  });
});

// --- insertColumn ---

describe("insertColumn", () => {
  it("inserts a column to the right", () => {
    const columns: LyricVerse[][] = [[verse("A")], [verse("B")]];
    const { lyrics, ops } = setup([[columns]]);
    ops.insertColumn(
      { stanzaIndex: 0, itemIndex: 0, columnIndex: 0, lineIndex: 0 },
      false
    );
    const item = lyrics.value[0][0] as LyricVerse[][];
    expect(item.length).toBe(3);
    expect(item[1][0].text).toBe("");
  });

  it("inserts a column to the left", () => {
    const columns: LyricVerse[][] = [[verse("A")], [verse("B")]];
    const { lyrics, ops } = setup([[columns]]);
    ops.insertColumn(
      { stanzaIndex: 0, itemIndex: 0, columnIndex: 1, lineIndex: 0 },
      true
    );
    const item = lyrics.value[0][0] as LyricVerse[][];
    expect(item.length).toBe(3);
    expect(item[1][0].text).toBe("");
  });
});
