import { describe, expect, it } from "vitest";

import {
  addStatusToLyrics,
  calculateOverlap,
  filterVisibleLyrics,
  getVerseStatus,
  isVerseVisible,
  regularizeLyrics,
  type LyricVerseWithStatus
} from "@/utils/lyricsViewerUtils";
import {
  overlappingTimedLyrics,
  timedLyrics,
  trackFilterLyrics
} from "@/__fixtures__/lyrics";

// --- getVerseStatus ---

describe("getVerseStatus", () => {
  it("returns 'future' when verse has no start_time", () => {
    const { status } = getVerseStatus({ text: "No time" }, 5, undefined);
    expect(status).toBe("future");
  });

  it("returns 'future' when currentTime is before start_time", () => {
    const { status } = getVerseStatus({ text: "V", start_time: 10 }, 5, 15);
    expect(status).toBe("future");
  });

  it("returns 'active' when currentTime is within range", () => {
    const { status } = getVerseStatus({ text: "V", start_time: 3, end_time: 6 }, 4, undefined);
    expect(status).toBe("active");
  });

  it("returns 'past' when currentTime is past end_time", () => {
    const { status } = getVerseStatus({ text: "V", start_time: 3, end_time: 6 }, 7, undefined);
    expect(status).toBe("past");
  });

  it("uses nextVerseStartTime as fallback end_time", () => {
    const { status, end_time } = getVerseStatus({ text: "V", start_time: 3 }, 4, 8);
    expect(end_time).toBe(8);
    expect(status).toBe("active");
  });

  it("uses start_time + 5 as fallback when no end_time or nextStartTime", () => {
    const { end_time } = getVerseStatus({ text: "V", start_time: 10 }, 11, undefined);
    expect(end_time).toBe(15);
  });

  it("returns 'active' at exact start_time", () => {
    const { status } = getVerseStatus({ text: "V", start_time: 5, end_time: 10 }, 5, undefined);
    expect(status).toBe("active");
  });

  it("returns 'past' at exact end_time", () => {
    const { status } = getVerseStatus({ text: "V", start_time: 5, end_time: 10 }, 10, undefined);
    expect(status).toBe("past");
  });

  it("handles start_time: 0 correctly (regression)", () => {
    const { status } = getVerseStatus({ text: "V", start_time: 0, end_time: 3 }, 1, undefined);
    expect(status).toBe("active");
  });

  it("handles start_time: 0 as past when currentTime exceeds end", () => {
    const { status } = getVerseStatus({ text: "V", start_time: 0, end_time: 3 }, 5, undefined);
    expect(status).toBe("past");
  });

  it("uses nextVerseStartTime: 0 as fallback end_time", () => {
    const { end_time } = getVerseStatus({ text: "V", start_time: 0 }, 0, 0);
    expect(end_time).toBe(0);
  });
});

// --- isVerseVisible ---

describe("isVerseVisible", () => {
  it("returns true when verse has no audio_track_ids", () => {
    expect(isVerseVisible({ text: "V" }, [1, 2])).toBe(true);
  });

  it("returns true when verse has matching track", () => {
    expect(isVerseVisible({ text: "V", audio_track_ids: [1, 3] }, [1, 2])).toBe(true);
  });

  it("returns false when verse has no matching tracks", () => {
    expect(isVerseVisible({ text: "V", audio_track_ids: [3, 4] }, [1, 2])).toBe(false);
  });

  it("returns true when verse has empty audio_track_ids", () => {
    expect(isVerseVisible({ text: "V", audio_track_ids: [] }, [1])).toBe(false);
  });
});

// --- calculateOverlap ---

describe("calculateOverlap", () => {
  it("returns 0 for no overlap", () => {
    expect(calculateOverlap(0, 5, 10, 15)).toBe(0);
  });

  it("returns 1 for full overlap (contained)", () => {
    expect(calculateOverlap(0, 10, 2, 8)).toBe(1);
  });

  it("returns correct partial overlap", () => {
    // verse1: 0-10, verse2: 5-15 → overlap 5-10 = 5, total = 10
    expect(calculateOverlap(0, 10, 5, 15)).toBe(0.5);
  });

  it("returns 0 when totalLength is 0", () => {
    expect(calculateOverlap(0, 5, 3, 3)).toBe(0);
  });

  it("returns 0 for adjacent non-overlapping ranges", () => {
    expect(calculateOverlap(0, 5, 5, 10)).toBe(0);
  });
});

// --- addStatusToLyrics ---

describe("addStatusToLyrics", () => {
  it("assigns correct statuses based on currentTime", () => {
    const result = addStatusToLyrics(timedLyrics, 4);

    const stanza0 = result[0] as LyricVerseWithStatus[];
    expect(stanza0[0].status).toBe("past"); // Intro (0-3), currentTime=4
    expect(stanza0[1].status).toBe("active"); // Verse one (3-6), currentTime=4
    expect(stanza0[2].status).toBe("future"); // Verse two (6-9), currentTime=4

    const stanza1 = result[1] as LyricVerseWithStatus[];
    expect(stanza1[0].status).toBe("future"); // Chorus (10-13)
  });

  it("uses next verse start_time as fallback end", () => {
    const lyrics = [[
      { text: "A", start_time: 1 },
      { text: "B", start_time: 5 }
    ]];
    const result = addStatusToLyrics(lyrics, 3);
    const stanza = result[0] as LyricVerseWithStatus[];
    // A: start=1, fallback end=5 (next verse start), currentTime=3 → active
    expect(stanza[0].status).toBe("active");
    expect(stanza[0].end_time).toBe(5);
  });
});

// --- filterVisibleLyrics ---

describe("filterVisibleLyrics", () => {
  it("keeps verses with no track IDs", () => {
    const withStatus = addStatusToLyrics(trackFilterLyrics, 0);
    const result = filterVisibleLyrics(withStatus, [999]); // non-matching track
    // "No track assigned" should survive, tracks 1 and 2 should be filtered
    const allTexts = (result[0] as LyricVerseWithStatus[]).map((v) => v.text);
    expect(allTexts).toContain("No track assigned");
    expect(allTexts).not.toContain("Only guitar");
    expect(allTexts).not.toContain("Only vocals");
  });

  it("keeps verses matching enabled tracks", () => {
    const withStatus = addStatusToLyrics(trackFilterLyrics, 0);
    const result = filterVisibleLyrics(withStatus, [1]);
    const allTexts = (result[0] as LyricVerseWithStatus[]).map((v) => v.text);
    expect(allTexts).toContain("Everyone sings"); // has track 1
    expect(allTexts).toContain("Only guitar"); // has track 1
    expect(allTexts).not.toContain("Only vocals"); // only track 2
  });

  it("removes empty stanzas entirely", () => {
    const withStatus = addStatusToLyrics(trackFilterLyrics, 0);
    // Filter with a track that matches nothing with track IDs
    const result = filterVisibleLyrics(withStatus, [999]);
    // Only "No track assigned" remains in 1 stanza
    expect(result.length).toBe(1);
  });
});

// --- regularizeLyrics ---

describe("regularizeLyrics", () => {
  it("wraps single verses as single-column lines", () => {
    const withStatus = addStatusToLyrics(timedLyrics, 0);
    const result = regularizeLyrics(withStatus);
    // First stanza has 3 verses, each should be its own line with 1 column
    expect(result[0].length).toBe(3);
    expect(result[0][0].columns.length).toBe(1);
  });

  it("merges overlapping verses into columns", () => {
    const withStatus = addStatusToLyrics(overlappingTimedLyrics, 0);
    const visible = filterVisibleLyrics(withStatus, []);
    const result = regularizeLyrics(visible);

    // Voice A (0-5) and Voice B (1-5) overlap > 40%, should merge
    // Solo (10-15) should be separate
    expect(result[0].length).toBe(2); // 2 lines
    expect(result[0][0].columns.length).toBe(2); // first line: 2 columns (merged)
    expect(result[0][1].columns.length).toBe(1); // second line: 1 column (solo)
  });

  it("does not merge non-overlapping verses", () => {
    const withStatus = addStatusToLyrics(timedLyrics, 0);
    const result = regularizeLyrics(withStatus);
    // All verses in first stanza are sequential, no merging
    result[0].forEach((line) => {
      expect(line.columns.length).toBe(1);
    });
  });
});
