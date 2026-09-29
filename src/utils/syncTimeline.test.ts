import { describe, expect, it } from "vitest";

import {
  applyRegionDrag,
  assignLanes,
  FOLLOW_PAUSE_MS,
  followScroll,
  formatClock,
  MIN_REGION,
  pxPerSecond,
  pxToTime,
  roundTime,
  rulerTicks,
  shouldFollow,
  snapTime,
  timeToPx
} from "./syncTimeline";

describe("pxPerSecond", () => {
  it("fits the whole song for 'toda'", () => {
    expect(pxPerSecond("toda", 200, 1000)).toBe(5);
  });

  it("fits the zoom window for 30 s and 10 s", () => {
    expect(pxPerSecond("30", 200, 900)).toBe(30);
    expect(pxPerSecond("10", 200, 900)).toBe(90);
  });

  it("is zero without a duration or a viewport", () => {
    expect(pxPerSecond("toda", 0, 900)).toBe(0);
    expect(pxPerSecond("30", 200, 0)).toBe(0);
  });
});

describe("time ↔ px", () => {
  it.each(["toda", "30", "10"] as const)("round-trips at zoom %s", (zoom) => {
    const pps = pxPerSecond(zoom, 245, 1100);
    for (const t of [0, 12.34, 100, 245]) {
      expect(pxToTime(timeToPx(t, pps), pps)).toBeCloseTo(t, 9);
    }
  });

  it("treats a zero scale as time zero", () => {
    expect(pxToTime(300, 0)).toBe(0);
  });
});

describe("snapping", () => {
  it("snaps to hundredths", () => {
    expect(snapTime(12.344)).toBeCloseTo(12.34, 9);
    expect(snapTime(12.346)).toBeCloseTo(12.35, 9);
  });

  it("rounds without float noise", () => {
    expect(roundTime(0.1 + 0.2)).toBe(0.3);
    expect(roundTime(29.499999)).toBe(29.5);
  });
});

describe("applyRegionDrag", () => {
  const region = { start: 10, end: 14 };

  it("moves the start but keeps it before the end", () => {
    expect(applyRegionDrag(region, "start", -2.004, 60)).toEqual({ start: 8, end: 14 });
    expect(applyRegionDrag(region, "start", 10, 60)).toEqual({ start: 14 - MIN_REGION, end: 14 });
  });

  it("never goes below zero", () => {
    expect(applyRegionDrag(region, "start", -20, 60)).toEqual({ start: 0, end: 14 });
    expect(applyRegionDrag(region, "move", -20, 60)).toEqual({ start: 0, end: 4 });
  });

  it("moves the end but keeps it after the start and within the song", () => {
    expect(applyRegionDrag(region, "end", 1.5, 60)).toEqual({ start: 10, end: 15.5 });
    expect(applyRegionDrag(region, "end", -10, 60)).toEqual({ start: 10, end: 10 + MIN_REGION });
    expect(applyRegionDrag(region, "end", 100, 60)).toEqual({ start: 10, end: 60 });
  });

  it("keeps the length when moving and clamps to the duration", () => {
    expect(applyRegionDrag(region, "move", 3.333, 60)).toEqual({ start: 13.33, end: 17.33 });
    expect(applyRegionDrag(region, "move", 100, 60)).toEqual({ start: 56, end: 60 });
  });
});

describe("rulerTicks", () => {
  it("spaces ticks at least the minimum gap apart", () => {
    const ticks = rulerTicks(60, 30, 80); // 30 px/s → every 5 s
    expect(ticks[1]! - ticks[0]!).toBe(5);
    expect(ticks.at(-1)).toBe(60);
  });

  it("is empty without a scale", () => {
    expect(rulerTicks(60, 0)).toEqual([]);
  });
});

describe("formatClock", () => {
  it("formats minutes and seconds", () => {
    expect(formatClock(27.4)).toBe("0:27");
    expect(formatClock(65.25, 2)).toBe("1:05.25");
  });

  it("carries rounding into the next minute", () => {
    expect(formatClock(59.96, 1)).toBe("1:00.0");
  });
});

describe("followScroll", () => {
  it("keeps the scroll while the playhead is comfortably visible", () => {
    expect(followScroll(500, 0, 1000, 5000)).toBe(0);
  });

  it("pages forward when the playhead nears the right edge", () => {
    expect(followScroll(950, 0, 1000, 5000)).toBe(650);
  });

  it("never scrolls past the content", () => {
    expect(followScroll(4990, 0, 1000, 5000)).toBe(4000);
  });
});

describe("assignLanes", () => {
  it("keeps regions that don't overlap in one lane", () => {
    expect(assignLanes([{ start: 0, end: 1 }, { start: 1, end: 2 }, { start: 2.5, end: 3 }])).toEqual([0, 0, 0]);
  });

  it("stacks overlapping regions", () => {
    expect(assignLanes([{ start: 0, end: 2 }, { start: 1, end: 3 }, { start: 2.5, end: 4 }])).toEqual([0, 1, 0]);
  });

  it("orders by start, not by input order", () => {
    expect(assignLanes([{ start: 1, end: 3 }, { start: 0, end: 2 }])).toEqual([1, 0]);
  });

  it("caps the number of lanes", () => {
    const all = [0, 0.1, 0.2, 0.3].map((start) => ({ start, end: 5 }));
    expect(assignLanes(all, 3)).toEqual([0, 1, 2, 2]);
  });
});

describe("shouldFollow", () => {
  it("follows until the user scrolls by hand, then waits a moment", () => {
    expect(shouldFollow(10_000, null)).toBe(true);
    expect(shouldFollow(10_000, 9_000)).toBe(false);
    expect(shouldFollow(9_000 + FOLLOW_PAUSE_MS, 9_000)).toBe(true);
  });
});
