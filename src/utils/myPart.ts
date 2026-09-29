import type { LyricVerse } from "@/data/types";
import type { MyPartState } from "@/composables/usePlayerState";

export const myPartStorageKey = (collectionId: number) => `ens-mipart-${collectionId}`;

export const EMPTY_MY_PART: MyPartState = { trackIds: [], duckOthers: false };

export function parseMyPart(raw: string | null): MyPartState {
  if (!raw) return EMPTY_MY_PART;
  try {
    const value = JSON.parse(raw) as Partial<MyPartState>;
    const trackIds = Array.isArray(value.trackIds)
      ? value.trackIds.filter((id): id is number => Number.isInteger(id))
      : [];
    return { trackIds, duckOthers: value.duckOthers === true };
  } catch {
    return EMPTY_MY_PART;
  }
}

/** Keep only tracks that exist in this song (a collection's songs have different track ids). */
export function myPartForSong(part: MyPartState, songTrackIds: number[]): MyPartState {
  return { ...part, trackIds: part.trackIds.filter((id) => songTrackIds.includes(id)) };
}

/**
 * A verse is dimmed when Mi parte is set and none of the verse's tracks is in it.
 * Verses without tracks belong to everyone and stay at full strength.
 */
export function isVerseDimmed(verse: Pick<LyricVerse, "audio_track_ids">, part: MyPartState): boolean {
  if (part.trackIds.length === 0) return false;
  const ids = verse.audio_track_ids ?? [];
  if (ids.length === 0) return false;
  return !ids.some((id) => part.trackIds.includes(id));
}
