import { describe, expect, it } from "vitest";

import {
  calculatePositionAfterDeletion,
  findNextValidPosition,
  type FocusPosition,
  getFirstPositionInItem,
  getItemAtPosition,
  getLastPositionInItem,
  isColumnContext,
  isColumnPosition,
  validatePosition
} from "@/utils/lyricsPositionUtils";
import {
  emptyLyrics,
  mixedColumnLyrics,
  singleVerseLyrics,
  threeVerseLyrics,
  twoStanzaLyrics
} from "@/__fixtures__/lyrics";

// --- Type guards ---

describe("isColumnContext", () => {
  it("returns false for regular position", () => {
    expect(isColumnContext({ stanzaIndex: 0, itemIndex: 0 })).toBe(false);
  });

  it("returns true for column position", () => {
    expect(isColumnContext({ stanzaIndex: 0, itemIndex: 0, columnIndex: 0, lineIndex: 0 })).toBe(
      true
    );
  });

  it("returns false when only columnIndex is set (no lineIndex)", () => {
    expect(isColumnContext({ stanzaIndex: 0, itemIndex: 0, columnIndex: 0 } as FocusPosition)).toBe(
      false
    );
  });
});

describe("isColumnPosition", () => {
  it("returns false for regular position", () => {
    expect(isColumnPosition({ stanzaIndex: 0, itemIndex: 0 })).toBe(false);
  });

  it("returns true for column position", () => {
    expect(isColumnPosition({ stanzaIndex: 0, itemIndex: 0, columnIndex: 1, lineIndex: 0 })).toBe(
      true
    );
  });
});

// --- validatePosition ---

describe("validatePosition", () => {
  it("returns false for empty lyrics", () => {
    expect(validatePosition({ stanzaIndex: 0, itemIndex: 0 }, emptyLyrics)).toBe(false);
  });

  it("returns true for valid regular position", () => {
    expect(validatePosition({ stanzaIndex: 0, itemIndex: 0 }, singleVerseLyrics)).toBe(true);
  });

  it("returns false for out-of-bounds stanza", () => {
    expect(validatePosition({ stanzaIndex: 5, itemIndex: 0 }, singleVerseLyrics)).toBe(false);
  });

  it("returns false for negative stanza index", () => {
    expect(validatePosition({ stanzaIndex: -1, itemIndex: 0 }, singleVerseLyrics)).toBe(false);
  });

  it("returns false for out-of-bounds item", () => {
    expect(validatePosition({ stanzaIndex: 0, itemIndex: 5 }, singleVerseLyrics)).toBe(false);
  });

  it("returns true for valid column position", () => {
    const pos: FocusPosition = { stanzaIndex: 0, itemIndex: 1, columnIndex: 0, lineIndex: 1 };
    expect(validatePosition(pos, mixedColumnLyrics)).toBe(true);
  });

  it("returns false for column index on non-column item", () => {
    const pos: FocusPosition = { stanzaIndex: 0, itemIndex: 0, columnIndex: 0, lineIndex: 0 };
    expect(validatePosition(pos, mixedColumnLyrics)).toBe(false);
  });

  it("returns false for out-of-bounds column index", () => {
    const pos: FocusPosition = { stanzaIndex: 0, itemIndex: 1, columnIndex: 5, lineIndex: 0 };
    expect(validatePosition(pos, mixedColumnLyrics)).toBe(false);
  });

  it("returns false for out-of-bounds line index", () => {
    const pos: FocusPosition = { stanzaIndex: 0, itemIndex: 1, columnIndex: 0, lineIndex: 5 };
    expect(validatePosition(pos, mixedColumnLyrics)).toBe(false);
  });
});

// --- getItemAtPosition ---

describe("getItemAtPosition", () => {
  it("returns verse for regular position", () => {
    const item = getItemAtPosition({ stanzaIndex: 0, itemIndex: 0 }, singleVerseLyrics);
    expect(item).toEqual({ text: "Hello world" });
  });

  it("returns column array for column item", () => {
    const item = getItemAtPosition({ stanzaIndex: 0, itemIndex: 1 }, mixedColumnLyrics);
    expect(Array.isArray(item)).toBe(true);
  });

  it("returns null for out-of-bounds", () => {
    const item = getItemAtPosition({ stanzaIndex: 5, itemIndex: 0 }, singleVerseLyrics);
    expect(item).toBeNull();
  });
});

// --- getFirstPositionInItem / getLastPositionInItem ---

describe("getFirstPositionInItem", () => {
  it("returns regular position for verse", () => {
    expect(getFirstPositionInItem({ text: "Test" }, 0, 0)).toEqual({
      stanzaIndex: 0,
      itemIndex: 0
    });
  });

  it("returns column 0, line 0 for column item", () => {
    const columns = [[{ text: "A" }], [{ text: "B" }]];
    expect(getFirstPositionInItem(columns, 1, 2)).toEqual({
      stanzaIndex: 1,
      itemIndex: 2,
      columnIndex: 0,
      lineIndex: 0
    });
  });

  it("returns null for undefined item", () => {
    expect(getFirstPositionInItem(undefined, 0, 0)).toBeNull();
  });
});

describe("getLastPositionInItem", () => {
  it("returns regular position for verse", () => {
    expect(getLastPositionInItem({ text: "Test" }, 0, 0)).toEqual({
      stanzaIndex: 0,
      itemIndex: 0
    });
  });

  it("returns last column, last line for column item", () => {
    const columns = [[{ text: "A" }, { text: "B" }], [{ text: "C" }]];
    expect(getLastPositionInItem(columns, 0, 1)).toEqual({
      stanzaIndex: 0,
      itemIndex: 1,
      columnIndex: 1,
      lineIndex: 0
    });
  });
});

// --- findNextValidPosition ---

describe("findNextValidPosition", () => {
  describe("vertical navigation", () => {
    it("moves down within a stanza", () => {
      const result = findNextValidPosition({ stanzaIndex: 0, itemIndex: 0 }, "down", threeVerseLyrics);
      expect(result).toEqual({ stanzaIndex: 0, itemIndex: 1 });
    });

    it("moves down across stanzas", () => {
      const result = findNextValidPosition({ stanzaIndex: 0, itemIndex: 1 }, "down", twoStanzaLyrics);
      expect(result).toEqual({ stanzaIndex: 1, itemIndex: 0 });
    });

    it("returns null at the end of lyrics (down)", () => {
      const result = findNextValidPosition({ stanzaIndex: 1, itemIndex: 1 }, "down", twoStanzaLyrics);
      expect(result).toBeNull();
    });

    it("moves up within a stanza", () => {
      const result = findNextValidPosition({ stanzaIndex: 0, itemIndex: 2 }, "up", threeVerseLyrics);
      expect(result).toEqual({ stanzaIndex: 0, itemIndex: 1 });
    });

    it("moves up across stanzas", () => {
      const result = findNextValidPosition({ stanzaIndex: 1, itemIndex: 0 }, "up", twoStanzaLyrics);
      expect(result).toEqual({ stanzaIndex: 0, itemIndex: 1 });
    });

    it("returns null at the beginning of lyrics (up)", () => {
      const result = findNextValidPosition({ stanzaIndex: 0, itemIndex: 0 }, "up", twoStanzaLyrics);
      expect(result).toBeNull();
    });
  });

  describe("column navigation", () => {
    it("moves down within a column", () => {
      const pos: FocusPosition = { stanzaIndex: 0, itemIndex: 1, columnIndex: 0, lineIndex: 0 };
      const result = findNextValidPosition(pos, "down", mixedColumnLyrics);
      expect(result).toEqual({ stanzaIndex: 0, itemIndex: 1, columnIndex: 0, lineIndex: 1 });
    });

    it("moves down from last line in column to next item", () => {
      const pos: FocusPosition = { stanzaIndex: 0, itemIndex: 1, columnIndex: 0, lineIndex: 1 };
      const result = findNextValidPosition(pos, "down", mixedColumnLyrics);
      expect(result).toEqual({ stanzaIndex: 0, itemIndex: 2 });
    });

    it("moves right between columns", () => {
      const pos: FocusPosition = { stanzaIndex: 0, itemIndex: 1, columnIndex: 0, lineIndex: 0 };
      const result = findNextValidPosition(pos, "right", mixedColumnLyrics);
      expect(result).toEqual({ stanzaIndex: 0, itemIndex: 1, columnIndex: 1, lineIndex: 0 });
    });

    it("moves left between columns", () => {
      const pos: FocusPosition = { stanzaIndex: 0, itemIndex: 1, columnIndex: 1, lineIndex: 0 };
      const result = findNextValidPosition(pos, "left", mixedColumnLyrics);
      expect(result).toEqual({ stanzaIndex: 0, itemIndex: 1, columnIndex: 0, lineIndex: 0 });
    });

    it("returns null when moving right from last column", () => {
      const pos: FocusPosition = { stanzaIndex: 0, itemIndex: 1, columnIndex: 1, lineIndex: 0 };
      const result = findNextValidPosition(pos, "right", mixedColumnLyrics);
      expect(result).toBeNull();
    });

    it("returns null when moving left from first column", () => {
      const pos: FocusPosition = { stanzaIndex: 0, itemIndex: 1, columnIndex: 0, lineIndex: 0 };
      const result = findNextValidPosition(pos, "left", mixedColumnLyrics);
      expect(result).toBeNull();
    });

    it("clamps line index when moving to shorter column", () => {
      // threeColumnLyrics has 3 columns, each with 1 line
      // mixedColumnLyrics col0 has 2 lines, col1 has 2 lines
      const pos: FocusPosition = { stanzaIndex: 0, itemIndex: 1, columnIndex: 0, lineIndex: 1 };
      const result = findNextValidPosition(pos, "right", mixedColumnLyrics);
      expect(result).toEqual({ stanzaIndex: 0, itemIndex: 1, columnIndex: 1, lineIndex: 1 });
    });

    it("returns null for horizontal on non-column item", () => {
      const result = findNextValidPosition({ stanzaIndex: 0, itemIndex: 0 }, "right", threeVerseLyrics);
      expect(result).toBeNull();
    });
  });

  describe("entering and exiting columns", () => {
    it("enters column item from above (down into columns)", () => {
      const result = findNextValidPosition({ stanzaIndex: 0, itemIndex: 0 }, "down", mixedColumnLyrics);
      expect(result).toEqual({ stanzaIndex: 0, itemIndex: 1, columnIndex: 0, lineIndex: 0 });
    });

    it("enters column item from below (up into columns)", () => {
      const result = findNextValidPosition({ stanzaIndex: 0, itemIndex: 2 }, "up", mixedColumnLyrics);
      // Should land on last position in the column item
      expect(result).toEqual({ stanzaIndex: 0, itemIndex: 1, columnIndex: 1, lineIndex: 1 });
    });
  });
});

// --- calculatePositionAfterDeletion ---

describe("calculatePositionAfterDeletion", () => {
  it("focuses previous verse after deleting middle item", () => {
    const result = calculatePositionAfterDeletion(
      { stanzaIndex: 0, itemIndex: 1 },
      threeVerseLyrics
    );
    expect(result).toEqual({ stanzaIndex: 0, itemIndex: 0 });
  });

  it("focuses next verse after deleting first item", () => {
    const result = calculatePositionAfterDeletion(
      { stanzaIndex: 0, itemIndex: 0 },
      // After deletion, the stanza would have items starting at index 0
      [[ { text: "Line 2" }, { text: "Line 3" }]]
    );
    expect(result).toEqual({ stanzaIndex: 0, itemIndex: 0 });
  });

  it("focuses previous stanza when current stanza is empty", () => {
    // Simulate: stanza 1 was emptied, stanza 0 still has items
    const result = calculatePositionAfterDeletion(
      { stanzaIndex: 1, itemIndex: 0 },
      [
        [{ text: "S1 L1" }, { text: "S1 L2" }],
        [] // empty stanza
      ]
    );
    expect(result).toEqual({ stanzaIndex: 0, itemIndex: 1 });
  });

  it("returns null when all lyrics are empty", () => {
    const result = calculatePositionAfterDeletion(
      { stanzaIndex: 0, itemIndex: 0 },
      [[]]
    );
    expect(result).toBeNull();
  });

  it("handles deletion within column — focuses previous line", () => {
    const pos: FocusPosition = { stanzaIndex: 0, itemIndex: 1, columnIndex: 0, lineIndex: 1 };
    const result = calculatePositionAfterDeletion(pos, mixedColumnLyrics);
    expect(result).toEqual({ stanzaIndex: 0, itemIndex: 1, columnIndex: 0, lineIndex: 0 });
  });
});
