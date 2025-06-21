import type { LyricStanza, LyricVerse } from "@/data/types";
import type { FocusPosition } from "@/utils/lyricsPositionUtils";
import { nextTick, type Ref } from "vue";
import { useLyricsCommands, type LyricsCommandActions } from "./useLyricsCommands";
import { useLyricsNavigation } from "./useLyricsNavigation";
import { useLyricsOperations } from "./useLyricsOperations";
import { useLyricsProperties } from "./useLyricsProperties";
import { useLyricsTimestamps } from "./useLyricsTimestamps";

// Re-export FocusPosition for backward compatibility
export type { FocusPosition };

export function useLyricsEditor(
  lyrics: Ref<LyricStanza[]>,
  updateLyrics: (newLyrics: LyricStanza[]) => void,
  onSave?: () => void,
  getCurrentTime?: () => number
) {
  // Initialize navigation composable
  const navigation = useLyricsNavigation(lyrics);
  const {
    currentFocus,
    getCurrentVerse,
    getVerseText,
    focusInput,
    isColumnContext,
    findPositionAfterDeletion,
    navigateHorizontal,
    navigateVertical,
    handleInputFocus
  } = navigation;

  // Helper function to update current verse
  const updateCurrentVerse = (
    position: FocusPosition,
    updater: (verse: LyricVerse) => void
  ): boolean => {
    const verse = getCurrentVerse(position);
    if (verse) {
      const currentLyrics = [...lyrics.value];
      updater(verse);
      updateLyrics(currentLyrics);
      return true;
    }
    return false;
  };

  // Initialize operations composable
  const operations = useLyricsOperations(
    lyrics,
    updateLyrics,
    focusInput,
    findPositionAfterDeletion
  );

  // Initialize timestamps composable
  const timestamps = useLyricsTimestamps(getCurrentTime, updateCurrentVerse);

  // Initialize properties composable
  const properties = useLyricsProperties(getCurrentVerse, updateCurrentVerse, focusInput);

  // Smart backspace handler
  const handleSmartBackspace = (): boolean => {
    if (!currentFocus.value) return false;

    const currentText = getVerseText(currentFocus.value);

    if (currentText === "") {
      operations.deleteLine(currentFocus.value);
      return true;
    }

    return false;
  };

  // Enhanced operations with inheritance
  const insertLineWithInheritance = (before: boolean = false) => {
    if (!currentFocus.value) return;

    const colorsToInherit = properties.getColorsForInheritance(currentFocus.value);
    const trackIdsToInherit = properties.getAudioTrackIdsForInheritance(currentFocus.value);

    operations.insertLine(currentFocus.value, before);

    nextTick(() => {
      if (colorsToInherit.length > 0) {
        properties.setCurrentVerseColors(currentFocus.value, colorsToInherit);
      }
      if (trackIdsToInherit.length > 0) {
        properties.setCurrentVerseAudioTrackIds(currentFocus.value, trackIdsToInherit);
      }
    });
  };

  const duplicateLineWithInheritance = () => {
    if (!currentFocus.value) return;
    operations.duplicateLine(currentFocus.value);
  };

  // Create action functions for commands
  const commandActions: LyricsCommandActions = {
    navigateVertical,
    navigateHorizontal,
    insertLineWithInheritance,
    insertLineOutsideColumn: (before?: boolean) => {
      if (currentFocus.value) {
        operations.insertLineOutsideColumn(currentFocus.value, before);
      }
    },
    deleteLine: () => {
      if (currentFocus.value) {
        operations.deleteLine(currentFocus.value);
      }
    },
    handleSmartBackspace,
    duplicateLineWithInheritance,
    toggleCopyPropertiesFromMode: properties.toggleCopyPropertiesFromMode,
    convertToColumns: () => {
      if (currentFocus.value) {
        operations.convertToColumns(currentFocus.value);
      }
    },
    insertColumn: (before?: boolean) => {
      if (currentFocus.value) {
        operations.insertColumn(currentFocus.value, before);
      }
    },
    insertStanza: () => {
      if (currentFocus.value) {
        operations.insertStanza(currentFocus.value);
      }
    },
    setCurrentVerseStartTime: () => timestamps.setCurrentVerseStartTime(currentFocus.value),
    setCurrentVerseEndTime: () => timestamps.setCurrentVerseEndTime(currentFocus.value),
    clearCurrentVerseStartTime: () => timestamps.clearCurrentVerseStartTime(currentFocus.value),
    clearCurrentVerseEndTime: () => timestamps.clearCurrentVerseEndTime(currentFocus.value),
    clearCurrentVerseBothTimes: () => timestamps.clearCurrentVerseBothTimes(currentFocus.value),
    adjustCurrentVerseStartTime: (deltaSeconds: number) =>
      timestamps.adjustCurrentVerseStartTime(currentFocus.value, deltaSeconds),
    adjustCurrentVerseEndTime: (deltaSeconds: number) =>
      timestamps.adjustCurrentVerseEndTime(currentFocus.value, deltaSeconds)
  };

  // Initialize commands composable
  const commands = useLyricsCommands(
    () => currentFocus.value,
    isColumnContext,
    commandActions,
    onSave
  );

  // Return the public API
  return {
    currentFocus,
    showHelp: commands.showHelp,
    handleInputFocus,
    focusInput,

    commandRegistry: commands.commandRegistry,

    getCurrentVerseColors: () => properties.getCurrentVerseColors(currentFocus.value),
    setCurrentVerseColors: (colors: string[]) =>
      properties.setCurrentVerseColors(currentFocus.value, colors),
    getCurrentVerseAudioTrackIds: () => properties.getCurrentVerseAudioTrackIds(currentFocus.value),
    setCurrentVerseAudioTrackIds: (trackIds: number[]) =>
      properties.setCurrentVerseAudioTrackIds(currentFocus.value, trackIds),
    copyPropertiesFromMode: properties.copyPropertiesFromMode,
    copyPropertiesFromVerse: (sourcePosition: FocusPosition) =>
      properties.copyPropertiesFromVerse(sourcePosition, currentFocus.value)
  };
}
