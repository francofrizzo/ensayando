import type { AudioTrack, CollectionPart, LyricVerse } from "@/data/types";

/** Preview the same materialized fields the database maintains on save. */
export function resolveVerseParts(
  verse: LyricVerse,
  parts: CollectionPart[],
  tracks: AudioTrack[]
): LyricVerse {
  if (verse.part_ids === undefined) return verse;
  const next = { ...verse };
  if (!verse.color_override) {
    next.color_keys = verse.part_ids.flatMap((id) => {
      const part = parts.find((p) => p.id === id);
      return part ? [part.color_key] : [];
    });
    next.color_override = false;
  }
  if (!verse.audio_override) {
    const ids = tracks
      .filter(
        (track) =>
          track.kind !== "instrumental" &&
          track.part_ids?.some((id) => verse.part_ids!.includes(id))
      )
      .map((track) => track.id)
      .sort((a, b) => a - b);
    if (ids.length) next.audio_track_ids = ids;
    else delete next.audio_track_ids;
    next.audio_override = false;
  }
  return next;
}

/** Assignments follow a copied/new verse; text, comments and times do not. */
export function verseAssignments(verse: LyricVerse): Partial<LyricVerse> {
  return {
    ...(verse.color_keys !== undefined ? { color_keys: [...verse.color_keys] } : {}),
    ...(verse.audio_track_ids !== undefined ? { audio_track_ids: [...verse.audio_track_ids] } : {}),
    ...(verse.part_ids !== undefined ? { part_ids: [...verse.part_ids] } : {}),
    ...(verse.audio_override !== undefined ? { audio_override: verse.audio_override } : {}),
    ...(verse.color_override !== undefined ? { color_override: verse.color_override } : {})
  };
}
