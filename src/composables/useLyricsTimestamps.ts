import type { LyricVerse } from "@/data/types";
import type { FocusPosition } from "@/utils/lyricsPositionUtils";

export function useLyricsTimestamps(
  getCurrentTime?: () => number,
  updateCurrentVerse?: (position: FocusPosition, updater: (verse: LyricVerse) => void) => boolean
) {
  const setCurrentVerseStartTime = (currentFocus: FocusPosition | null) => {
    if (!currentFocus || !getCurrentTime || !updateCurrentVerse) return;

    const currentTime = getCurrentTime();
    updateCurrentVerse(currentFocus, (verse) => {
      verse.start_time = currentTime;
    });
  };

  const setCurrentVerseEndTime = (currentFocus: FocusPosition | null) => {
    if (!currentFocus || !getCurrentTime || !updateCurrentVerse) return;

    const currentTime = getCurrentTime();
    updateCurrentVerse(currentFocus, (verse) => {
      verse.end_time = currentTime;
    });
  };

  const adjustCurrentVerseStartTime = (
    currentFocus: FocusPosition | null,
    deltaSeconds: number
  ) => {
    if (!currentFocus || !updateCurrentVerse) return;

    updateCurrentVerse(currentFocus, (verse) => {
      if (verse.start_time !== undefined) {
        verse.start_time = Math.max(0, verse.start_time + deltaSeconds);
      }
    });
  };

  const adjustCurrentVerseEndTime = (currentFocus: FocusPosition | null, deltaSeconds: number) => {
    if (!currentFocus || !updateCurrentVerse) return;

    updateCurrentVerse(currentFocus, (verse) => {
      if (verse.end_time !== undefined) {
        verse.end_time = Math.max(0, verse.end_time + deltaSeconds);
      }
    });
  };

  const clearCurrentVerseStartTime = (currentFocus: FocusPosition | null) => {
    if (!currentFocus || !updateCurrentVerse) return;

    updateCurrentVerse(currentFocus, (verse) => {
      verse.start_time = undefined;
    });
  };

  const clearCurrentVerseEndTime = (currentFocus: FocusPosition | null) => {
    if (!currentFocus || !updateCurrentVerse) return;

    updateCurrentVerse(currentFocus, (verse) => {
      verse.end_time = undefined;
    });
  };

  const clearCurrentVerseBothTimes = (currentFocus: FocusPosition | null) => {
    if (!currentFocus || !updateCurrentVerse) return;

    updateCurrentVerse(currentFocus, (verse) => {
      verse.start_time = undefined;
      verse.end_time = undefined;
    });
  };

  return {
    setCurrentVerseStartTime,
    setCurrentVerseEndTime,
    adjustCurrentVerseStartTime,
    adjustCurrentVerseEndTime,
    clearCurrentVerseStartTime,
    clearCurrentVerseEndTime,
    clearCurrentVerseBothTimes
  };
}
