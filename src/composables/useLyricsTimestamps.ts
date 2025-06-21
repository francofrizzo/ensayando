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
    clearCurrentVerseStartTime,
    clearCurrentVerseEndTime,
    clearCurrentVerseBothTimes
  };
}
