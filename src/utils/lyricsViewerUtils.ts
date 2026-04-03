import type { LyricStanza, LyricVerse } from "@/data/types";

export type LyricVerseStatus = "active" | "past" | "future";
export type LyricVerseWithStatus = LyricVerse & { status: LyricVerseStatus };
export type LyricStanzaWithStatus = (LyricVerseWithStatus | LyricVerseWithStatus[][])[];

export type RegularizedLyricLine = {
  columns: LyricVerseWithStatus[][];
  start_time?: number;
  end_time?: number;
};
export type RegularizedLyricStanza = RegularizedLyricLine[];

export const OVERLAP_THRESHOLD = 0.4;

export const isVerseVisible = (verse: LyricVerse, enabledTrackIds: number[]): boolean => {
  return (
    !verse.audio_track_ids ||
    verse.audio_track_ids.some((trackId) => enabledTrackIds.includes(trackId))
  );
};

export const getItemStartTime = (
  item: LyricVerse | LyricVerseWithStatus | LyricVerse[][] | LyricVerseWithStatus[][]
): number | undefined => {
  if (Array.isArray(item)) {
    return Math.min(
      ...item
        .flatMap((column) => column.map((verse) => verse.start_time))
        .filter((time) => time !== undefined)
    );
  }
  return item.start_time;
};

export const getVerseStatus = (
  verse: LyricVerse,
  currentTime: number,
  nextVerseStartTime: number | undefined
): { status: LyricVerseStatus; end_time: number | undefined } => {
  let status: LyricVerseStatus = "future";
  let endTime: number | undefined = undefined;

  if (verse.start_time !== undefined) {
    endTime = verse.end_time ?? (nextVerseStartTime !== undefined ? nextVerseStartTime : verse.start_time + 5);
    if (currentTime >= verse.start_time) {
      status = currentTime < endTime ? "active" : "past";
    }
  }

  return { status, end_time: endTime };
};

export const addStatusToLyrics = (
  lyrics: LyricStanza[],
  currentTime: number
): LyricStanzaWithStatus[] => {
  return lyrics.map((stanza, stanzaIndex): LyricStanzaWithStatus => {
    const nextStanza = lyrics[stanzaIndex + 1];
    return stanza.map((item, itemIndex) => {
      if (Array.isArray(item)) {
        return item.map((column) =>
          column.map((verse, verseIndex) => {
            const nextItem = column[verseIndex + 1] ?? stanza[itemIndex + 1] ?? nextStanza?.[0];
            const nextLyricStartTime = nextItem ? getItemStartTime(nextItem) : undefined;
            const { status, end_time } = getVerseStatus(verse, currentTime, nextLyricStartTime);
            return { ...verse, end_time, status };
          })
        );
      } else {
        const nextLyricItem = stanza[itemIndex + 1] ?? nextStanza?.[0];
        const nextLyricStartTime = nextLyricItem ? getItemStartTime(nextLyricItem) : undefined;
        const { status, end_time } = getVerseStatus(item, currentTime, nextLyricStartTime);
        return { ...item, end_time, status };
      }
    });
  });
};

export const filterVisibleLyrics = (
  stanzas: LyricStanzaWithStatus[],
  enabledTrackIds: number[]
): LyricStanzaWithStatus[] => {
  return stanzas
    .map((stanza) => {
      const filtered = stanza
        .filter((item) => {
          if (Array.isArray(item)) {
            return item.some((column) =>
              column.some((verse) => isVerseVisible(verse, enabledTrackIds))
            );
          }
          return isVerseVisible(item, enabledTrackIds);
        })
        .map((item) => {
          if (Array.isArray(item)) {
            return item
              .map((column) => column.filter((verse) => isVerseVisible(verse, enabledTrackIds)))
              .filter((column) => column.length > 0);
          }
          return item;
        });
      return filtered.length > 0 ? filtered : [];
    })
    .filter((group) => group.length > 0);
};

/** Calculate how much of verse2 overlaps with verse1 */
export const calculateOverlap = (
  start1: number,
  end1: number,
  start2: number,
  end2: number
): number => {
  const overlapStart = Math.max(start1, start2);
  const overlapEnd = Math.min(end1, end2);
  const overlappingLength = Math.max(0, overlapEnd - overlapStart);
  const totalLength = end2 - start2;

  return totalLength > 0 ? overlappingLength / totalLength : 0;
};

export const regularizeLyrics = (
  stanzas: LyricStanzaWithStatus[]
): RegularizedLyricStanza[] => {
  return stanzas.map((stanza): RegularizedLyricStanza => {
    const lines: RegularizedLyricLine[] = [];
    for (const item of stanza) {
      if (Array.isArray(item)) {
        const startTimes = item
          .flatMap((col) => col.map((verse) => verse.start_time))
          .filter((time) => time !== undefined);
        const endTimes = item
          .flatMap((col) => col.map((verse) => verse.end_time))
          .filter((time) => time !== undefined);
        lines.push({
          start_time: Math.min(...startTimes),
          end_time: Math.max(...endTimes),
          columns: item
        });
      } else {
        const previousLine = lines[lines.length - 1];
        if (
          previousLine &&
          item.start_time &&
          item.end_time &&
          previousLine.start_time &&
          previousLine.end_time
        ) {
          const overlap = calculateOverlap(
            item.start_time,
            item.end_time,
            previousLine.start_time,
            previousLine.end_time
          );
          if (overlap > OVERLAP_THRESHOLD) {
            previousLine.columns.push([item]);
            previousLine.end_time = Math.max(previousLine.end_time, item.end_time);
            continue;
          }
        }
        lines.push({
          start_time: item.start_time,
          end_time: item.end_time,
          columns: [[item]]
        });
      }
    }
    return lines;
  });
};
