import type { TrackPeaks } from "@/data/types";

export type SilenceSkip = { start: number; end: number };

/** Null means incomplete/unusable data; an empty list means no useful pauses. */
export function silenceSkips(
  voices: { peaks: TrackPeaks | null; duration: number }[],
  playbackDuration: number
): SilenceSkip[] | null {
  if (!voices.length || !Number.isFinite(playbackDuration) || playbackDuration <= 0) return null;
  const activity: SilenceSkip[] = [];
  for (const { peaks, duration } of voices) {
    if (
      !peaks ||
      !Number.isFinite(duration) ||
      duration <= 0 ||
      !Number.isFinite(peaks.duration) ||
      peaks.duration <= 0 ||
      Math.abs(peaks.duration - duration) > 0.1 ||
      !Array.isArray(peaks.channels) ||
      !peaks.channels.length
    )
      return null;
    let hasActivity = false;
    for (const channel of peaks.channels) {
      if (!Array.isArray(channel) || !channel.length) return null;
      const bin = peaks.duration / channel.length;
      for (let i = 0; i < channel.length; i++) {
        const value = channel[i]!;
        if (!Number.isFinite(value)) return null;
        if (value !== 0) {
          hasActivity = true;
          // Stored bins are not sample-exact. Expand their boundaries rather
          // than risking an entrance because of rounded duration/bin timing.
          const start = Math.max(0, i * bin - 0.1);
          if (start < playbackDuration) {
            activity.push({ start, end: Math.min(playbackDuration, (i + 1) * bin + 0.1) });
          }
        }
      }
    }
    // Zero-only data cannot establish that this recording really is silent.
    if (!hasActivity) return null;
  }
  activity.sort((a, b) => a.start - b.start);
  const skips: SilenceSkip[] = [];
  let end = 0;
  for (const interval of activity) {
    const start = end === 0 ? 0 : end + 2;
    const stop = interval.start - 5;
    if (stop - start >= 8) skips.push({ start, end: stop });
    end = Math.max(end, interval.end);
  }
  // Loaded voices cannot contain audio beyond their own duration. The clock may
  // belong to a longer instrumental; omit that vocal pause up to the actual end.
  const outroStart = end + 2;
  if (activity.length && playbackDuration - outroStart >= 8) {
    skips.push({ start: outroStart, end: playbackDuration });
  }
  return skips;
}
