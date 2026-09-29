// Pure logic for Sincronizar: what gets marked (units) and how marking changes the lyrics.
//
// A unit is what one ↓ marks: a regular verse, or one row of a multicolumn line
// (the verses side by side are sung together, so they share their times).

import type { LyricStanza, LyricVerse } from "@/data/types";
import type { FocusPosition } from "@/utils/lyricsPositionUtils";
import { roundTime } from "@/utils/syncTimeline";

export type SyncUnit = {
  /** Stable within one lyrics shape: "s-i" or "s-i-r" for a column row. */
  id: string;
  stanzaIndex: number;
  positions: FocusPosition[];
  texts: string[];
  colorKeys: string[];
  comment?: string;
  start?: number;
  end?: number;
};

export type SyncUnitState = "sin-tiempo" | "marcado" | "marcando";

const cloneLyrics = (lyrics: LyricStanza[]): LyricStanza[] => JSON.parse(JSON.stringify(lyrics));

export const verseAt = (lyrics: LyricStanza[], position: FocusPosition): LyricVerse | undefined => {
  const item = lyrics[position.stanzaIndex]?.[position.itemIndex];
  if (!item) return undefined;
  if (Array.isArray(item)) {
    if (position.columnIndex === undefined || position.lineIndex === undefined) return undefined;
    return item[position.columnIndex]?.[position.lineIndex];
  }
  return item;
};

const minDefined = (values: (number | undefined)[]) => {
  const defined = values.filter((v): v is number => typeof v === "number");
  return defined.length ? Math.min(...defined) : undefined;
};

const maxDefined = (values: (number | undefined)[]) => {
  const defined = values.filter((v): v is number => typeof v === "number");
  return defined.length ? Math.max(...defined) : undefined;
};

const unitFrom = (
  id: string,
  stanzaIndex: number,
  positions: FocusPosition[],
  verses: LyricVerse[]
): SyncUnit => {
  const colorKeys: string[] = [];
  for (const verse of verses) {
    for (const key of verse.color_keys ?? []) if (!colorKeys.includes(key)) colorKeys.push(key);
  }
  return {
    id,
    stanzaIndex,
    positions,
    texts: verses.map((verse) => verse.text),
    colorKeys,
    comment: verses.find((verse) => verse.comment)?.comment,
    start: minDefined(verses.map((verse) => verse.start_time)),
    end: maxDefined(verses.map((verse) => verse.end_time))
  };
};

/** Every unit in reading order. Empty verses are skipped: there's nothing to sing. */
export const buildSyncUnits = (lyrics: LyricStanza[]): SyncUnit[] => {
  const units: SyncUnit[] = [];
  lyrics.forEach((stanza, stanzaIndex) => {
    stanza.forEach((item, itemIndex) => {
      if (!Array.isArray(item)) {
        if (!item.text.trim()) return;
        units.push(unitFrom(`${stanzaIndex}-${itemIndex}`, stanzaIndex, [{ stanzaIndex, itemIndex }], [item]));
        return;
      }
      const rows = Math.max(0, ...item.map((column) => column.length));
      for (let lineIndex = 0; lineIndex < rows; lineIndex++) {
        const positions: FocusPosition[] = [];
        const verses: LyricVerse[] = [];
        item.forEach((column, columnIndex) => {
          const verse = column[lineIndex];
          if (verse && verse.text.trim()) {
            positions.push({ stanzaIndex, itemIndex, columnIndex, lineIndex });
            verses.push(verse);
          }
        });
        if (verses.length) {
          units.push(unitFrom(`${stanzaIndex}-${itemIndex}-${lineIndex}`, stanzaIndex, positions, verses));
        }
      }
    });
  });
  return units;
};

export const unitState = (unit: SyncUnit, isCursor: boolean): SyncUnitState =>
  isCursor ? "marcando" : unit.start !== undefined ? "marcado" : "sin-tiempo";

/** Where marking starts: the first unit without a start time (or the first one). */
export const firstUnmarkedIndex = (units: SyncUnit[]): number => {
  const index = units.findIndex((unit) => unit.start === undefined);
  return index === -1 ? 0 : index;
};

const forEachVerse = (lyrics: LyricStanza[], unit: SyncUnit, fn: (verse: LyricVerse) => void) => {
  for (const position of unit.positions) {
    const verse = verseAt(lyrics, position);
    if (verse) fn(verse);
  }
};

/**
 * ↓: the unit starts at `time`. If the previous unit has no end yet, it ends here too,
 * so a verse sung straight into the next one doesn't need a second key.
 * An end that would now come before the start is dropped.
 */
export const markStart = (
  lyrics: LyricStanza[],
  units: SyncUnit[],
  index: number,
  time: number
): LyricStanza[] => {
  const unit = units[index];
  if (!unit) return lyrics;
  const at = roundTime(Math.max(0, time));
  const next = cloneLyrics(lyrics);

  forEachVerse(next, unit, (verse) => {
    verse.start_time = at;
    if (verse.end_time !== undefined && verse.end_time <= at) delete verse.end_time;
  });

  const previous = units[index - 1];
  if (previous) {
    forEachVerse(next, previous, (verse) => {
      if (verse.end_time === undefined && verse.start_time !== undefined && verse.start_time < at) {
        verse.end_time = at;
      }
    });
  }
  return next;
};

/** ⌘.: the unit ends at `time` (ignored if that would come before its start). */
export const markEnd = (lyrics: LyricStanza[], unit: SyncUnit, time: number): LyricStanza[] => {
  const at = roundTime(Math.max(0, time));
  if (unit.start !== undefined && at <= unit.start) return lyrics;
  const next = cloneLyrics(lyrics);
  forEachVerse(next, unit, (verse) => {
    verse.end_time = at;
  });
  return next;
};

/** Region drag result: both times on every verse of the unit. */
export const setUnitTimes = (
  lyrics: LyricStanza[],
  unit: SyncUnit,
  start: number,
  end: number
): LyricStanza[] => {
  const next = cloneLyrics(lyrics);
  forEachVerse(next, unit, (verse) => {
    verse.start_time = roundTime(start);
    verse.end_time = roundTime(end);
  });
  return next;
};

/** Where a unit's region ends when it has no end: the next marked start, or start + 4 s. */
export const regionEnd = (units: SyncUnit[], index: number, duration: number): number | undefined => {
  const unit = units[index];
  if (!unit || unit.start === undefined) return undefined;
  if (unit.end !== undefined) return unit.end;
  const nextStart = units.slice(index + 1).find((u) => u.start !== undefined)?.start;
  const fallback = unit.start + 4;
  const end = nextStart !== undefined && nextStart > unit.start ? nextStart : fallback;
  return duration > 0 ? Math.min(end, duration) : end;
};

const collectTimes = (lyrics: LyricStanza[]) => {
  const times = new Map<string, number | undefined>();
  lyrics.forEach((stanza, s) =>
    stanza.forEach((item, i) => {
      const put = (key: string, verse: LyricVerse) => {
        times.set(`${key}:start`, verse.start_time);
        times.set(`${key}:end`, verse.end_time);
      };
      if (Array.isArray(item)) {
        item.forEach((column, c) => column.forEach((verse, l) => put(`${s}-${i}-${c}-${l}`, verse)));
      } else {
        put(`${s}-${i}`, item);
      }
    })
  );
  return times;
};

/** "6 tiempos nuevos": times set or changed since the saved version. */
export const countNewTimes = (saved: LyricStanza[], current: LyricStanza[]): number => {
  const before = collectTimes(saved);
  let count = 0;
  for (const [key, value] of collectTimes(current)) {
    if (value !== undefined && before.get(key) !== value) count++;
  }
  return count;
};
