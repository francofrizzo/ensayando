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
  it("keeps five seconds before entrances, two after exits, and omits the outro", () => {
    expect(silenceSkips([voice([bins(100, [30, 35], [70, 75])])], 100)).toEqual([
      { start: 0, end: 24.9 },
      { start: 37.1, end: 64.9 },
      { start: 77.1, end: 100 }
    ]);
  });

  it("unions every channel and selected voice at its own duration and resolution", () => {
    const first = voice([bins(100, [0, 10], [80, 90]), bins(50, [15, 20])], 100);
    expect(silenceSkips([first], 100)).toEqual([
      { start: 12.1, end: 24.9 },
      { start: 42.1, end: 74.9 }
    ]);
    const second = voice([bins(40, [5, 40])], 80);
    expect(silenceSkips([first, second], 100)).toEqual([]);
  });

  it("requires eight seconds of net saving after padding, including at the end", () => {
    expect(silenceSkips([voice([bins(60, [0, 10], [25, 60])])], 60)).toEqual([]);
    expect(silenceSkips([voice([bins(60, [0, 10], [26, 60])])], 60)).toEqual([
      { start: 12.1, end: 20.9 }
    ]);
    expect(silenceSkips([voice([bins(60, [0, 50])])], 60)).toEqual([]);
    expect(silenceSkips([voice([bins(60, [0, 50])])], 60.1)).toEqual([{ start: 52.1, end: 60.1 }]);
    expect(silenceSkips([voice([bins(60, [0, 49])])], 60)).toEqual([{ start: 51.1, end: 60 }]);
  });

  it("uses the playback end even when the vocal recording is shorter or longer", () => {
    expect(silenceSkips([voice([bins(60, [0, 20])])], 100)).toEqual([{ start: 22.1, end: 100 }]);
    expect(silenceSkips([voice([bins(120, [0, 10], [70, 80])])], 60)).toEqual([
      { start: 12.1, end: 60 }
    ]);
  });

  it("treats tiny fractional or signed nonzero peaks as activity", () => {
    expect(silenceSkips([voice([Array(60).fill(0.00001)])], 60)).toEqual([]);
    expect(silenceSkips([voice([Array(60).fill(-0.5)])], 60)).toEqual([]);
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
      expect(silenceSkips([valid, invalid], 60)).toBeNull();
    expect(silenceSkips([], 60)).toBeNull();
    expect(silenceSkips([valid], NaN)).toBeNull();
  });
});
