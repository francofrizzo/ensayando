import type { LyricVerse } from "@/data/types";
import type { FocusPosition } from "@/utils/lyricsPositionUtils";
import { nextTick, ref } from "vue";

export function useLyricsProperties(
  getCurrentVerse?: (position: FocusPosition) => LyricVerse | null,
  updateCurrentVerse?: (position: FocusPosition, updater: (verse: LyricVerse) => void) => boolean,
  focusInput?: (position: FocusPosition) => Promise<void>
) {
  const copyPropertiesFromMode = ref(false);

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

  const toggleCopyPropertiesFromMode = () => {
    copyPropertiesFromMode.value = !copyPropertiesFromMode.value;
  };

  const copyPropertiesFromVerse = (
    sourcePosition: FocusPosition,
    currentFocus: FocusPosition | null
  ) => {
    if (!currentFocus || !copyPropertiesFromMode.value || !getCurrentVerse || !focusInput) return;

    const originalFocus = { ...currentFocus };

    const sourceVerse = getCurrentVerse(sourcePosition);
    if (!sourceVerse) return;

    const sourceColors = sourceVerse.color_keys || [];
    const sourceTrackIds = sourceVerse.audio_track_ids || [];

    setCurrentVerseColors(currentFocus, [...sourceColors]);
    setCurrentVerseAudioTrackIds(currentFocus, [...sourceTrackIds]);

    copyPropertiesFromMode.value = false;

    nextTick(() => {
      focusInput(originalFocus);
    });
  };

  return {
    copyPropertiesFromMode,
    getColorsForInheritance,
    getAudioTrackIdsForInheritance,
    getCurrentVerseColors,
    setCurrentVerseColors,
    getCurrentVerseAudioTrackIds,
    setCurrentVerseAudioTrackIds,
    toggleCopyPropertiesFromMode,
    copyPropertiesFromVerse
  };
}
