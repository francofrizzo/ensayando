import { describe, expect, it } from "vitest";

import { silenceSkips } from "@/utils/silence-skips";

const voice = (channels: number[][], duration = channels[0]!.length) => ({
  duration,
  peaks: { duration, channels }
});
const bins = (length: number, ...activity: [number, number][]) =>
  Array.from({ length }, (_, i) =>
    activity.some(([start, end]) => i >= start && i < end) ? 1 : 0
  );

describe("silenceSkips", () => {
  it("pads entrances/exits and offers an intro but never an outro", () => {
    expect(silenceSkips([voice([bins(100, [30, 35], [70, 75])])])).toEqual([
      { start: 0, end: 24.9 },
      { start: 40.1, end: 64.9 }
    ]);
  });

  it("unions every channel and selected voice at its own duration and resolution", () => {
    const first = voice([bins(100, [0, 10], [80, 90]), bins(50, [15, 20])], 100);
    expect(silenceSkips([first])).toEqual([{ start: 45.1, end: 74.9 }]);
    const second = voice([bins(40, [5, 40])], 80);
    expect(silenceSkips([first, second])).toEqual([]);
  });

  it("requires ten seconds of net saving, not ten seconds of raw silence", () => {
    expect(silenceSkips([voice([bins(60, [0, 10], [30, 60])])])).toEqual([]);
    expect(silenceSkips([voice([bins(60, [0, 10], [31, 60])])])).toEqual([
      { start: 15.1, end: 25.9 }
    ]);
  });

  it("treats tiny fractional or signed nonzero peaks as activity", () => {
    expect(silenceSkips([voice([Array(60).fill(0.00001)])])).toEqual([]);
    expect(silenceSkips([voice([Array(60).fill(-0.5)])])).toEqual([]);
  });

  it("fails closed for any missing, invalid, zero-only or duration-mismatched selected data", () => {
    const valid = voice([bins(60, [0, 10], [50, 60])]);
    for (const invalid of [
      { duration: 60, peaks: null },
      voice([], 60),
      voice([[]], 60),
      voice([Array(60).fill(0)]),
      voice([[1, NaN]], 60),
      voice([[1, Infinity]], 60),
      { ...valid, duration: 61 },
      { ...valid, duration: NaN }
    ])
      expect(silenceSkips([valid, invalid])).toBeNull();
    expect(silenceSkips([])).toBeNull();
  });
});
