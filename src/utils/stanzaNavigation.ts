import type { LyricStanza, LyricVerse } from "@/data/types";

const versesOf = (stanza: LyricStanza): LyricVerse[] =>
  stanza.flatMap((item) => (Array.isArray(item) ? item.flat() : [item]));

/** Start time of each stanza that has one (its earliest verse start), sorted. */
export function stanzaStartTimes(lyrics: LyricStanza[]): number[] {
  const times = lyrics
    .map((stanza) => {
      const starts = versesOf(stanza)
        .map((verse) => verse.start_time)
        .filter((time): time is number => typeof time === "number");
      return starts.length > 0 ? Math.min(...starts) : null;
    })
    .filter((time): time is number => time !== null);
  return [...new Set(times)].sort((a, b) => a - b);
}

// Pressing ↑ right after a stanza starts should go to the one before it,
// like "previous track" on a music player.
const BACK_GRACE = 1;

export function previousStanzaTime(starts: number[], currentTime: number): number {
  const earlier = starts.filter((time) => time < currentTime - BACK_GRACE);
  return earlier.length > 0 ? earlier[earlier.length - 1]! : 0;
}

export function nextStanzaTime(starts: number[], currentTime: number): number | null {
  return starts.find((time) => time > currentTime + 0.05) ?? null;
}
