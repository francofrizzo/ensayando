import type { LyricStanza, LyricVerse } from "@/data/types";
import type { FocusPosition } from "@/utils/lyricsPositionUtils";

/** "stanza-item" or "stanza-item-column-line": the same key the textareas use. */
export const positionKey = (position: FocusPosition): string =>
  position.columnIndex !== undefined && position.lineIndex !== undefined
    ? `${position.stanzaIndex}-${position.itemIndex}-${position.columnIndex}-${position.lineIndex}`
    : `${position.stanzaIndex}-${position.itemIndex}`;

export const samePosition = (a: FocusPosition | null, b: FocusPosition | null): boolean =>
  !!a && !!b && positionKey(a) === positionKey(b);

/** Every verse position in reading order (columns left to right, top to bottom). */
export const listVersePositions = (lyrics: LyricStanza[]): FocusPosition[] => {
  const positions: FocusPosition[] = [];
  lyrics.forEach((stanza, stanzaIndex) => {
    stanza.forEach((item, itemIndex) => {
      if (Array.isArray(item)) {
        item.forEach((column, columnIndex) => {
          column.forEach((_, lineIndex) => {
            positions.push({ stanzaIndex, itemIndex, columnIndex, lineIndex });
          });
        });
      } else {
        positions.push({ stanzaIndex, itemIndex });
      }
    });
  });
  return positions;
};

export const getVerseAt = (lyrics: LyricStanza[], position: FocusPosition): LyricVerse | null => {
  const item = lyrics[position.stanzaIndex]?.[position.itemIndex];
  if (!item) return null;
  if (Array.isArray(item)) {
    if (position.columnIndex === undefined || position.lineIndex === undefined) return null;
    return item[position.columnIndex]?.[position.lineIndex] ?? null;
  }
  return position.columnIndex === undefined ? item : null;
};

/** The verses between two positions, both included, in reading order. */
export const selectRange = (
  lyrics: LyricStanza[],
  anchor: FocusPosition,
  target: FocusPosition
): FocusPosition[] => {
  const positions = listVersePositions(lyrics);
  const keys = positions.map(positionKey);
  const from = keys.indexOf(positionKey(anchor));
  const to = keys.indexOf(positionKey(target));
  if (from === -1 || to === -1) return to === -1 ? [] : [target];
  const [start, end] = from <= to ? [from, to] : [to, from];
  return positions.slice(start, end + 1);
};

/** Adds the position when missing and removes it when present (⌘+clic). */
export const togglePosition = (
  selection: FocusPosition[],
  position: FocusPosition
): FocusPosition[] => {
  const key = positionKey(position);
  return selection.some((p) => positionKey(p) === key)
    ? selection.filter((p) => positionKey(p) !== key)
    : [...selection, position];
};

/** The next or previous verse in reading order, for ⇧↑ / ⇧↓. */
export const adjacentPosition = (
  lyrics: LyricStanza[],
  position: FocusPosition,
  direction: "up" | "down"
): FocusPosition | null => {
  const positions = listVersePositions(lyrics);
  const index = positions.findIndex((p) => samePosition(p, position));
  if (index === -1) return null;
  return positions[index + (direction === "down" ? 1 : -1)] ?? null;
};

/** Keeps only positions that still point at a verse (after structure changes). */
export const pruneSelection = (
  lyrics: LyricStanza[],
  selection: FocusPosition[]
): FocusPosition[] => selection.filter((position) => getVerseAt(lyrics, position) !== null);

export type Presence = "all" | "some" | "none";

export type SelectionSummary = {
  count: number;
  colors: Record<string, Presence>;
  tracks: Record<number, Presence>;
  /** The shared comment, or null when the verses differ. */
  comment: { value: string | undefined; mixed: boolean };
};

const presence = (hits: number, total: number): Presence =>
  hits === 0 ? "none" : hits === total ? "all" : "some";

/** What the selected verses have in common, for the inspector. */
export const summarizeSelection = (
  lyrics: LyricStanza[],
  selection: FocusPosition[],
  colorKeys: string[],
  trackIds: number[]
): SelectionSummary => {
  const verses = selection
    .map((position) => getVerseAt(lyrics, position))
    .filter((verse): verse is LyricVerse => verse !== null);
  const total = verses.length;

  const colors: Record<string, Presence> = {};
  for (const key of colorKeys) {
    colors[key] = presence(verses.filter((v) => v.color_keys?.includes(key)).length, total);
  }
  const tracks: Record<number, Presence> = {};
  for (const id of trackIds) {
    tracks[id] = presence(verses.filter((v) => v.audio_track_ids?.includes(id)).length, total);
  }

  const comments = new Set(verses.map((v) => v.comment));
  const comment =
    comments.size <= 1
      ? { value: verses[0]?.comment, mixed: false }
      : { value: undefined, mixed: true };

  return { count: total, colors, tracks, comment };
};

// Lyrics from the store can be reactive proxies; a JSON copy is plain and matches the schema.
const cloneLyrics = (lyrics: LyricStanza[]): LyricStanza[] =>
  JSON.parse(JSON.stringify(lyrics)) as LyricStanza[];

/** Runs an update on every selected verse of a copy of the lyrics (one undo step). */
export const updateVerses = (
  lyrics: LyricStanza[],
  selection: FocusPosition[],
  updater: (verse: LyricVerse) => void
): LyricStanza[] => {
  const next = cloneLyrics(lyrics);
  for (const position of selection) {
    const verse = getVerseAt(next, position);
    if (verse) updater(verse);
  }
  return next;
};

/**
 * One tap on a color: when every selected verse has it, it's removed from all;
 * otherwise it's added (at the end, so it becomes the last color of the gradient)
 * to the verses that are missing it.
 */
export const toggleColorInVerses = (
  lyrics: LyricStanza[],
  selection: FocusPosition[],
  colorKey: string
): LyricStanza[] => {
  const { colors } = summarizeSelection(lyrics, selection, [colorKey], []);
  const removeFromAll = colors[colorKey] === "all";
  return updateVerses(lyrics, selection, (verse) => {
    const current = verse.color_keys ?? [];
    const next = removeFromAll
      ? current.filter((key) => key !== colorKey)
      : current.includes(colorKey)
        ? current
        : [...current, colorKey];
    if (next.length === 0) delete verse.color_keys;
    else verse.color_keys = next;
  });
};

/** Same rule as colors, for the tracks a verse belongs to. */
export const toggleTrackInVerses = (
  lyrics: LyricStanza[],
  selection: FocusPosition[],
  trackId: number
): LyricStanza[] => {
  const { tracks } = summarizeSelection(lyrics, selection, [], [trackId]);
  const removeFromAll = tracks[trackId] === "all";
  return updateVerses(lyrics, selection, (verse) => {
    const current = verse.audio_track_ids ?? [];
    const next = removeFromAll
      ? current.filter((id) => id !== trackId)
      : current.includes(trackId)
        ? current
        : [...current, trackId];
    if (next.length === 0) delete verse.audio_track_ids;
    else verse.audio_track_ids = next;
  });
};

/** Sets (or, with undefined, removes) the comment of every selected verse. */
export const setCommentInVerses = (
  lyrics: LyricStanza[],
  selection: FocusPosition[],
  comment: string | undefined
): LyricStanza[] =>
  updateVerses(lyrics, selection, (verse) => {
    if (comment === undefined) delete verse.comment;
    else verse.comment = comment;
  });

/**
 * Drag and drop: moves a whole item (a verse, or a row of columns) so it lands just
 * before the target item, or at the end of the target stanza when targetItemIndex is
 * the stanza length. Returns the new lyrics and where the moved item ended up.
 * A stanza left empty is removed.
 */
export const moveItemTo = (
  lyrics: LyricStanza[],
  from: { stanzaIndex: number; itemIndex: number },
  to: { stanzaIndex: number; itemIndex: number }
): { lyrics: LyricStanza[]; position: { stanzaIndex: number; itemIndex: number } } | null => {
  const next = cloneLyrics(lyrics);
  const source = next[from.stanzaIndex];
  const item = source?.[from.itemIndex];
  if (!source || item === undefined || !next[to.stanzaIndex]) return null;

  let targetStanza = to.stanzaIndex;
  let targetItem = to.itemIndex;
  if (targetStanza === from.stanzaIndex && targetItem > from.itemIndex) targetItem -= 1;
  if (targetStanza === from.stanzaIndex && targetItem === from.itemIndex) return null;

  source.splice(from.itemIndex, 1);
  if (source.length === 0) {
    next.splice(from.stanzaIndex, 1);
    if (targetStanza > from.stanzaIndex) targetStanza -= 1;
  }
  const destination = next[targetStanza]!;
  targetItem = Math.min(targetItem, destination.length);
  destination.splice(targetItem, 0, item);
  return { lyrics: next, position: { stanzaIndex: targetStanza, itemIndex: targetItem } };
};

/** Nudges a verse time by a step (e.g. ±0,1 s), rounded to hundredths, never below 0. */
export const nudgeTime = (time: number | undefined, step: number): number =>
  Math.max(0, Math.round(((time ?? 0) + step) * 100) / 100);

/** "0:27,40" for the inspector and the sheet. */
export const formatVerseTime = (time: number | undefined): string | null => {
  if (time === undefined || time === null || Number.isNaN(time)) return null;
  const minutes = Math.floor(time / 60);
  const seconds = time - minutes * 60;
  const [whole, hundredths] = seconds.toFixed(2).split(".");
  return `${minutes}:${whole!.padStart(2, "0")},${hundredths}`;
};

/**
 * Reads what someone typed in a time field: "0:27,40", "1:02.5", "27,4" or "27.4".
 * Empty means "no time"; anything unreadable returns null (keep the old value).
 */
export const parseVerseTime = (input: string): number | undefined | null => {
  const text = input.trim().replace(",", ".");
  if (text === "") return undefined;
  const match = /^(?:(\d+):)?(\d+(?:\.\d*)?)$/.exec(text);
  if (!match) return null;
  const minutes = match[1] ? Number(match[1]) : 0;
  const seconds = Number(match[2]);
  if (match[1] && seconds >= 60) return null;
  return Math.round((minutes * 60 + seconds) * 100) / 100;
};

/** Positions of the verses sounding at a given time (with the same rules as the player). */
export const activeVerseKeys = (
  statusLyrics: ({ status?: string } | { status?: string }[][])[][]
): Set<string> => {
  const keys = new Set<string>();
  statusLyrics.forEach((stanza, stanzaIndex) => {
    stanza.forEach((item, itemIndex) => {
      if (Array.isArray(item)) {
        item.forEach((column, columnIndex) =>
          column.forEach((verse, lineIndex) => {
            if (verse.status === "active") {
              keys.add(positionKey({ stanzaIndex, itemIndex, columnIndex, lineIndex }));
            }
          })
        );
      } else if (item.status === "active") {
        keys.add(positionKey({ stanzaIndex, itemIndex }));
      }
    });
  });
  return keys;
};

/**
 * What the editor shows for a song without lyrics: one empty verse. A new object on
 * every call, because the editor writes into it (a shared constant would carry typed
 * text over to other songs and survive "Descartar").
 */
export function createEmptyLyrics(): LyricStanza[] {
  return [[{ text: "", start_time: undefined, end_time: undefined }]];
}

/**
 * "Copiar de este verso": gives every selected verse exactly the colors and tracks
 * of the source verse (order included). Comments and times are left alone.
 */
export const copyColorsAndTracks = (
  lyrics: LyricStanza[],
  source: FocusPosition,
  targets: FocusPosition[]
): LyricStanza[] => {
  const from = getVerseAt(lyrics, source);
  if (!from) return lyrics;
  const colorKeys = from.color_keys?.length ? [...from.color_keys] : undefined;
  const trackIds = from.audio_track_ids?.length ? [...from.audio_track_ids] : undefined;
  return updateVerses(lyrics, targets, (verse) => {
    if (colorKeys) verse.color_keys = [...colorKeys];
    else delete verse.color_keys;
    if (trackIds) verse.audio_track_ids = [...trackIds];
    else delete verse.audio_track_ids;
  });
};
