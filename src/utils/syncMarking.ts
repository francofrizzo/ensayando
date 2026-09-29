// Pure logic for Sincronizar: what gets marked (units) and how marking changes the lyrics.
//
// A unit is what one ↓ marks: one verse. In a multicolumn line each column is its own
// voice, with its own lines and times (columns don't have to line up), so its verses
// are separate units, in the same order the player reads them: column by column, top
// to bottom (see getVerseStatus, which ends a column verse at the next one in its column).

import type { LyricStanza, LyricVerse } from "@/data/types";
import type { FocusPosition } from "@/utils/lyricsPositionUtils";
import { roundTime } from "@/utils/syncTimeline";

export type SyncUnit = {
  /** Stable within one lyrics shape: "s-i" or "s-i-c-l" for a column verse. */
  id: string;
  stanzaIndex: number;
  /** "main" for regular verses; "s-i-c" for the verses of one column. */
  voice: string;
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
  voice: string,
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
    voice,
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
        units.push(
          unitFrom(
            `${stanzaIndex}-${itemIndex}`,
            stanzaIndex,
            "main",
            [{ stanzaIndex, itemIndex }],
            [item]
          )
        );
        return;
      }
      item.forEach((column, columnIndex) => {
        column.forEach((verse, lineIndex) => {
          if (!verse.text.trim()) return;
          const position = { stanzaIndex, itemIndex, columnIndex, lineIndex };
          units.push(
            unitFrom(
              `${stanzaIndex}-${itemIndex}-${columnIndex}-${lineIndex}`,
              stanzaIndex,
              `${stanzaIndex}-${itemIndex}-${columnIndex}`,
              [position],
              [verse]
            )
          );
        });
      });
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
 * ↓: the unit starts at `time`. The previous unit, when it's in the same stanza and the
 * same voice (never across columns), ends here too if it had no end yet, or if its end was tied to this unit's old start (so
 * re-marking moves both together instead of opening a gap or an overlap). Across a
 * stanza break the previous end is left alone: the last verse of a stanza shouldn't stay
 * lit through an instrumental.
 * An end of this unit that would now come before its start is dropped.
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
  const oldStart = unit.start;
  const next = cloneLyrics(lyrics);

  forEachVerse(next, unit, (verse) => {
    verse.start_time = at;
    if (verse.end_time !== undefined && verse.end_time <= at) delete verse.end_time;
  });

  const previous = units[index - 1];
  if (previous && previous.stanzaIndex === unit.stanzaIndex && previous.voice === unit.voice) {
    forEachVerse(next, previous, (verse) => {
      const tied = oldStart !== undefined && verse.end_time === oldStart;
      if (
        (verse.end_time === undefined || tied) &&
        verse.start_time !== undefined &&
        verse.start_time < at
      ) {
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

/**
 * Which unit ⌘. ends: the one at the cursor once it has a start (it's sounding),
 * otherwise the one just marked (↓ already moved the cursor past it).
 */
export const endTargetIndex = (units: SyncUnit[], cursor: number): number | undefined => {
  const index = units[cursor]?.start !== undefined ? cursor : cursor - 1;
  return units[index] ? index : undefined;
};

/**
 * ⌘.: "Marcar fin y avanzar". Ends the target unit at `time`; if that was the cursor's
 * unit, the cursor moves on (unless it's the last). If the end went to the unit before
 * the cursor, the cursor is already past it and stays. A rejected end moves nothing.
 */
export const markEndAndAdvance = (
  lyrics: LyricStanza[],
  units: SyncUnit[],
  cursor: number,
  time: number
): { lyrics: LyricStanza[]; cursor: number } => {
  const index = endTargetIndex(units, cursor);
  if (index === undefined) return { lyrics, cursor };
  const next = markEnd(lyrics, units[index]!, time);
  if (next === lyrics) return { lyrics, cursor };
  const advance = index === cursor && cursor < units.length - 1;
  return { lyrics: next, cursor: advance ? cursor + 1 : cursor };
};

/** "Quitar fin": the unit has no end again (same object if it had none). */
export const clearEnd = (lyrics: LyricStanza[], unit: SyncUnit): LyricStanza[] => {
  let hasEnd = false;
  forEachVerse(lyrics, unit, (verse) => {
    if (verse.end_time !== undefined) hasEnd = true;
  });
  if (!hasEnd) return lyrics;
  const next = cloneLyrics(lyrics);
  forEachVerse(next, unit, (verse) => {
    delete verse.end_time;
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

const itemKey = (unit: SyncUnit) => {
  const position = unit.positions[0]!;
  return `${position.stanzaIndex}-${position.itemIndex}`;
};

/**
 * Where a unit's region ends when it has no end, the way the player ends it: for a
 * column verse, the next marked verse in its column; otherwise the next item that has
 * a later start (a regular verse or a whole row of columns, whose start is its
 * earliest verse). Else start + 4 s.
 */
export const regionEnd = (
  units: SyncUnit[],
  index: number,
  duration: number
): number | undefined => {
  const unit = units[index];
  if (!unit || unit.start === undefined) return undefined;
  if (unit.end !== undefined) return unit.end;
  const startsLater = (u: SyncUnit) => u.start !== undefined && u.start > unit.start!;
  const later = units.slice(index + 1);

  let end: number | undefined;
  if (unit.voice !== "main") {
    end = later.find((u) => u.voice === unit.voice && startsLater(u))?.start;
  }
  if (end === undefined) {
    const ownItem = itemKey(unit);
    const next = later.find((u) => itemKey(u) !== ownItem && startsLater(u));
    if (next) {
      const nextItem = itemKey(next);
      end = minDefined(
        later.filter((u) => itemKey(u) === nextItem && startsLater(u)).map((u) => u.start)
      );
    }
  }
  end ??= unit.start + 4;
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
        item.forEach((column, c) =>
          column.forEach((verse, l) => put(`${s}-${i}-${c}-${l}`, verse))
        );
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

/**
 * Units that start before an earlier unit in reading order: usually a mistake while
 * marking (a key pressed late, or a verse marked twice). Columns are separate voices, so
 * a column verse is only compared with its own column and with the regular verses before
 * its line; a regular verse is compared with everything before it. Units without a start
 * are skipped.
 */
export const outOfOrderIndices = (units: SyncUnit[]): Set<number> => {
  const flagged = new Set<number>();
  let latestAll = -Infinity;
  let latestMain = -Infinity;
  const latestByVoice = new Map<string, number>();
  units.forEach((unit, index) => {
    if (unit.start === undefined) return;
    const bound =
      unit.voice === "main"
        ? latestAll
        : Math.max(latestMain, latestByVoice.get(unit.voice) ?? -Infinity);
    if (unit.start < bound - 1e-9) {
      flagged.add(index);
      return;
    }
    latestAll = Math.max(latestAll, unit.start);
    if (unit.voice === "main") latestMain = unit.start;
    else latestByVoice.set(unit.voice, unit.start);
  });
  return flagged;
};
