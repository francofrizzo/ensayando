// Pure math for the Sincronizar timeline: zoom, time ↔ px, snapping and region drags.

export type SyncZoom = "toda" | "30" | "10";

export const SYNC_ZOOMS: { id: SyncZoom; label: string }[] = [
  { id: "toda", label: "Toda" },
  { id: "30", label: "30 s" },
  { id: "10", label: "10 s" }
];

/** Every time the timeline writes is rounded to hundredths, like the lyrics editor does. */
export const SNAP_STEP = 0.01;
/** A region can't be shorter than this. */
export const MIN_REGION = 0.1;

/** Pixels per second so that the zoom window fills the viewport ("toda": the whole song). */
export const pxPerSecond = (zoom: SyncZoom, duration: number, viewportWidth: number): number => {
  if (viewportWidth <= 0) return 0;
  const window = zoom === "toda" ? duration : Number(zoom);
  if (!(window > 0)) return 0;
  return viewportWidth / window;
};

export const timeToPx = (time: number, pps: number) => time * pps;

export const pxToTime = (px: number, pps: number) => (pps > 0 ? px / pps : 0);

export const snapTime = (time: number, step = SNAP_STEP) => Math.round(time / step) * step;

/** Rounds to 2 decimals without float noise (12.300000000000001 → 12.3). */
export const roundTime = (time: number) => Number(snapTime(time).toFixed(2));

export const clampTime = (time: number, duration: number) =>
  Math.min(Math.max(0, time), duration > 0 ? duration : Infinity);

export type Region = { start: number; end: number };
export type DragMode = "start" | "end" | "move";

/**
 * New region after dragging by `delta` seconds.
 * Keeps start < end (at least MIN_REGION apart), never negative, never past the duration,
 * and a moved region keeps its length.
 */
export const applyRegionDrag = (
  region: Region,
  mode: DragMode,
  delta: number,
  duration: number
): Region => {
  const max = duration > 0 ? duration : Infinity;
  if (mode === "move") {
    const length = region.end - region.start;
    const start = Math.min(Math.max(0, region.start + delta), Math.max(0, max - length));
    return { start: roundTime(start), end: roundTime(start + length) };
  }
  if (mode === "start") {
    const start = Math.min(Math.max(0, region.start + delta), region.end - MIN_REGION);
    return { start: roundTime(start), end: region.end };
  }
  const end = Math.max(Math.min(max, region.end + delta), region.start + MIN_REGION);
  return { start: region.start, end: roundTime(end) };
};

/** Tick spacing (seconds) so ticks are at least `minGapPx` apart. */
export const tickStep = (pps: number, minGapPx = 80): number => {
  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120];
  for (const step of steps) if (step * pps >= minGapPx) return step;
  return steps[steps.length - 1]!;
};

export const rulerTicks = (duration: number, pps: number, minGapPx = 80): number[] => {
  if (!(duration > 0) || !(pps > 0)) return [];
  const step = tickStep(pps, minGapPx);
  const ticks: number[] = [];
  for (let t = 0; t <= duration + 1e-9; t += step) ticks.push(Number(t.toFixed(3)));
  return ticks;
};

/** "0:27" / "1:05.5" for the ruler and the verse list. */
export const formatClock = (time: number, decimals = 0): string => {
  const factor = 10 ** decimals;
  // Round once up front so 59.96 s with one decimal reads 1:00.0, not 0:59.10
  const units = Math.round(Math.max(0, time) * factor);
  const totalSeconds = Math.floor(units / factor);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  if (decimals === 0) return `${minutes}:${seconds}`;
  const fraction = String(units % factor).padStart(decimals, "0");
  return `${minutes}:${seconds}.${fraction}`;
};

/** Scroll offset that keeps the playhead visible, paging when it leaves the viewport. */
export const followScroll = (
  playheadPx: number,
  scrollLeft: number,
  viewportWidth: number,
  contentWidth: number
): number => {
  const margin = viewportWidth * 0.15;
  if (playheadPx >= scrollLeft + margin && playheadPx <= scrollLeft + viewportWidth - margin) {
    return scrollLeft;
  }
  const target = playheadPx - viewportWidth * 0.3;
  return Math.min(Math.max(0, target), Math.max(0, contentWidth - viewportWidth));
};

/** After the user scrolls the timeline by hand, following the playhead waits this long. */
export const FOLLOW_PAUSE_MS = 3000;

/** Whether the view should follow the playhead, given when the user last scrolled by hand. */
export const shouldFollow = (now: number, lastManualScrollAt: number | null): boolean =>
  lastManualScrollAt === null || now - lastManualScrollAt >= FOLLOW_PAUSE_MS;

/** At most this many stacked lanes; further overlaps share the last one. */
export const MAX_LANES = 3;

/**
 * Lane for each region so overlapping regions stack instead of piling up.
 * Greedy by start time: each region takes the first lane that is free when it starts.
 * Returns one lane index per input region, in input order.
 */
export const assignLanes = (regions: Region[], maxLanes = MAX_LANES): number[] => {
  const order = regions.map((_, index) => index).sort((a, b) => regions[a]!.start - regions[b]!.start);
  const laneEnds: number[] = [];
  const lanes = new Array<number>(regions.length).fill(0);
  for (const index of order) {
    const region = regions[index]!;
    let lane = laneEnds.findIndex((end) => end <= region.start + 1e-9);
    if (lane === -1) lane = laneEnds.length < maxLanes ? laneEnds.length : maxLanes - 1;
    laneEnds[lane] = Math.max(laneEnds[lane] ?? 0, region.end);
    lanes[index] = lane;
  }
  return lanes;
};
