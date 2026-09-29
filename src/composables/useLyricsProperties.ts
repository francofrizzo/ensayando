import type { LyricVerse } from "@/data/types";
import type { FocusPosition } from "@/utils/lyricsPositionUtils";

export function useLyricsProperties(
  getCurrentVerse?: (position: FocusPosition) => LyricVerse | null,
  updateCurrentVerse?: (position: FocusPosition, updater: (verse: LyricVerse) => void) => boolean
) {
  const getColorsForInheritance = (currentFocus: FocusPosition | null): string[] => {
    if (!currentFocus || !getCurrentVerse) return [];
    const verse = getCurrentVerse(currentFocus);
    return verse?.color_keys || [];
  };

  const getAudioTrackIdsForInheritance = (currentFocus: FocusPosition | null): number[] => {
    if (!currentFocus || !getCurrentVerse) return [];
    const verse = getCurrentVerse(currentFocus);
    return verse?.audio_track_ids || [];
  };

  const getCurrentVerseColors = (currentFocus: FocusPosition | null): string[] => {
    if (!currentFocus || !getCurrentVerse) return [];
    const verse = getCurrentVerse(currentFocus);
    return verse?.color_keys || [];
  };

  const setCurrentVerseColors = (currentFocus: FocusPosition | null, colors: string[]) => {
    if (!currentFocus || !updateCurrentVerse) return;

    updateCurrentVerse(currentFocus, (verse) => {
      if (colors.length === 0) {
        delete verse.color_keys;
      } else {
        verse.color_keys = colors;
      }
    });
  };

  const getCurrentVerseAudioTrackIds = (currentFocus: FocusPosition | null): number[] => {
    if (!currentFocus || !getCurrentVerse) return [];
    const verse = getCurrentVerse(currentFocus);
    return verse?.audio_track_ids || [];
  };

  const setCurrentVerseAudioTrackIds = (currentFocus: FocusPosition | null, trackIds: number[]) => {
    if (!currentFocus || !updateCurrentVerse) return;

    updateCurrentVerse(currentFocus, (verse) => {
      if (trackIds.length === 0) {
        delete verse.audio_track_ids;
      } else {
        verse.audio_track_ids = trackIds;
      }
    });
  };

  const getCurrentVerseComment = (currentFocus: FocusPosition | null): string | undefined => {
    if (!currentFocus || !getCurrentVerse) return undefined;
    const verse = getCurrentVerse(currentFocus);
    return verse?.comment;
  };

  const setCurrentVerseComment = (
    currentFocus: FocusPosition | null,
    comment: string | undefined
  ) => {
    if (!currentFocus || !updateCurrentVerse) return;
    updateCurrentVerse(currentFocus, (verse) => {
      if (comment === undefined) {
        delete verse.comment;
      } else {
        verse.comment = comment;
      }
    });
  };

  return {
    getColorsForInheritance,
    getAudioTrackIdsForInheritance,
    getCurrentVerseColors,
    setCurrentVerseColors,
    getCurrentVerseAudioTrackIds,
    setCurrentVerseAudioTrackIds,
    getCurrentVerseComment,
    setCurrentVerseComment
  };
}
