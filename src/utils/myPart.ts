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

/** "Bajar el resto" halves the other tracks' volume on their own sliders. */
export const LOWER_REST_FACTOR = 0.5;

/**
 * Which volumes to move when "Bajar el resto" is on or off. The change shows on
 * each track's slider, so it stays visible and adjustable. `saved` holds each
 * lowered track's volume from before, to put it back when the option goes off;
 * a track that was moved by hand in between keeps its new volume.
 */
export function lowerRestVolumes(
  tracks: readonly { id: number; volume: number }[],
  part: MyPartState,
  saved: Readonly<Record<number, number>>
): { changes: Record<number, number>; saved: Record<number, number> } {
  const lowering = part.duckOthers && part.trackIds.length > 0;
  const changes: Record<number, number> = {};
  const nextSaved: Record<number, number> = { ...saved };
  for (const track of tracks) {
    const shouldLower = lowering && !part.trackIds.includes(track.id);
    const previous = nextSaved[track.id];
    if (shouldLower && previous === undefined) {
      nextSaved[track.id] = track.volume;
      changes[track.id] = track.volume * LOWER_REST_FACTOR;
    } else if (!shouldLower && previous !== undefined) {
      if (Math.abs(track.volume - previous * LOWER_REST_FACTOR) < 0.005) changes[track.id] = previous;
      delete nextSaved[track.id];
    }
  }
  return { changes, saved: nextSaved };
}
