import type { LyricVerse } from "@/data/types";
import type { FocusPosition } from "@/utils/lyricsPositionUtils";
import { ref } from "vue";

export function useLyricsProperties(
  getCurrentVerse?: (position: FocusPosition) => LyricVerse | null,
  updateCurrentVerse?: (position: FocusPosition, updater: (verse: LyricVerse) => void) => boolean
) {
  const copyPropertiesToMode = ref(false);
  const sourcePosition = ref<FocusPosition | null>(null);

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

  const toggleCopyPropertiesToMode = (currentFocus: FocusPosition | null) => {
    if (!copyPropertiesToMode.value) {
      // Entering copy mode - store the source position
      sourcePosition.value = currentFocus ? { ...currentFocus } : null;
      copyPropertiesToMode.value = true;
    } else {
      // Exiting copy mode - clear source position
      sourcePosition.value = null;
      copyPropertiesToMode.value = false;
    }
  };

  const exitCopyPropertiesToMode = () => {
    sourcePosition.value = null;
    copyPropertiesToMode.value = false;
  };

  const copyPropertiesToVerse = (targetPosition: FocusPosition) => {
    if (!copyPropertiesToMode.value || !sourcePosition.value || !getCurrentVerse) return;

    const sourceVerse = getCurrentVerse(sourcePosition.value);
    if (!sourceVerse) return;

    const sourceColors = sourceVerse.color_keys || [];
    const sourceTrackIds = sourceVerse.audio_track_ids || [];

    setCurrentVerseColors(targetPosition, [...sourceColors]);
    setCurrentVerseAudioTrackIds(targetPosition, [...sourceTrackIds]);
  };

  return {
    copyPropertiesToMode,
    sourcePosition,
    getColorsForInheritance,
    getAudioTrackIdsForInheritance,
    getCurrentVerseColors,
    setCurrentVerseColors,
    getCurrentVerseAudioTrackIds,
    setCurrentVerseAudioTrackIds,
    toggleCopyPropertiesToMode,
    exitCopyPropertiesToMode,
    copyPropertiesToVerse
  };
}
