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
  updateLyrics: (newLyrics: LyricStanza[], focus?: FocusPosition | null) => void,
  onSave?: () => void,
  getCurrentTime?: () => number,
  seekTo?: (time: number) => void,
  onUndo?: () => FocusPosition | null,
  onRedo?: () => FocusPosition | null
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

  // Wrap updateLyrics to always pass the current focus for undo/redo
  const updateLyricsWithFocus = (newLyrics: LyricStanza[]) => {
    updateLyrics(newLyrics, currentFocus.value);
  };

  // Helper function to update current verse
  const updateCurrentVerse = (
    position: FocusPosition,
    updater: (verse: LyricVerse) => void
  ): boolean => {
    const verse = getCurrentVerse(position);
    if (verse) {
      const currentLyrics = [...lyrics.value];
      updater(verse);
      updateLyricsWithFocus(currentLyrics);
      return true;
    }
    return false;
  };

  // Initialize operations composable
  const operations = useLyricsOperations(
    lyrics,
    updateLyricsWithFocus,
    focusInput,
    findPositionAfterDeletion
  );

  // Initialize timestamps composable
  const timestamps = useLyricsTimestamps(getCurrentTime, updateCurrentVerse);

  // Initialize properties composable
  const properties = useLyricsProperties(getCurrentVerse, updateCurrentVerse);

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

    const initialProps: Record<string, unknown> = {};
    if (colorsToInherit.length > 0) initialProps.color_keys = colorsToInherit;
    if (trackIdsToInherit.length > 0) initialProps.audio_track_ids = trackIdsToInherit;

    operations.insertLine(currentFocus.value, before, initialProps);
  };

  const duplicateLineWithInheritance = () => {
    if (!currentFocus.value) return;
    operations.duplicateLine(currentFocus.value);
  };

  const insertColumnWithInheritance = (before: boolean = false) => {
    if (!currentFocus.value) return;
    operations.insertColumn(currentFocus.value, before);
  };

  const convertToColumnsWithInheritance = () => {
    if (!currentFocus.value) return;
    operations.convertToColumns(currentFocus.value);
  };

  const insertStanzaWithInheritance = () => {
    if (!currentFocus.value) return;

    const colorsToInherit = properties.getColorsForInheritance(currentFocus.value);
    const trackIdsToInherit = properties.getAudioTrackIdsForInheritance(currentFocus.value);

    const initialProps: Record<string, unknown> = {};
    if (colorsToInherit.length > 0) initialProps.color_keys = colorsToInherit;
    if (trackIdsToInherit.length > 0) initialProps.audio_track_ids = trackIdsToInherit;

    operations.insertStanza(currentFocus.value, initialProps);
  };

  // Stamp and advance: set start time then move to next verse
  const stampAndAdvance = () => {
    timestamps.setCurrentVerseStartTime(currentFocus.value);
    navigateVertical("down");
  };

  // Seek to current verse's start time
  const seekToCurrentVerse = () => {
    if (!currentFocus.value || !seekTo) return;
    const verse = getCurrentVerse(currentFocus.value);
    if (verse?.start_time !== undefined) {
      seekTo(verse.start_time);
    }
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
    toggleCopyPropertiesToMode: () => properties.toggleCopyPropertiesToMode(currentFocus.value),
    exitCopyPropertiesToMode: properties.exitCopyPropertiesToMode,
    convertToColumns: () => {
      convertToColumnsWithInheritance();
    },
    insertColumn: (before?: boolean) => {
      insertColumnWithInheritance(before);
    },
    insertStanza: () => {
      insertStanzaWithInheritance();
    },
    setCurrentVerseStartTime: () => timestamps.setCurrentVerseStartTime(currentFocus.value),
    setCurrentVerseEndTime: () => timestamps.setCurrentVerseEndTime(currentFocus.value),
    clearCurrentVerseStartTime: () => timestamps.clearCurrentVerseStartTime(currentFocus.value),
    clearCurrentVerseEndTime: () => timestamps.clearCurrentVerseEndTime(currentFocus.value),
    clearCurrentVerseBothTimes: () => timestamps.clearCurrentVerseBothTimes(currentFocus.value),
    stampAndAdvance,
    seekToCurrentVerse,
    clearStanzaTimes: () => {
      if (currentFocus.value) operations.clearStanzaTimes(currentFocus.value);
    },
    moveLineUp: () => {
      if (currentFocus.value) operations.moveLine(currentFocus.value, "up");
    },
    moveLineDown: () => {
      if (currentFocus.value) operations.moveLine(currentFocus.value, "down");
    },
    splitStanza: () => {
      if (currentFocus.value) operations.splitStanza(currentFocus.value);
    },
    joinStanzas: () => {
      if (currentFocus.value) operations.joinStanzas(currentFocus.value);
    },
    undo: () => {
      const focus = onUndo?.() ?? null;
      if (focus) focusInput(focus);
    },
    redo: () => {
      const focus = onRedo?.() ?? null;
      if (focus) focusInput(focus);
    }
  };

  // Initialize commands composable
  const commands = useLyricsCommands(
    () => currentFocus.value,
    isColumnContext,
    commandActions,
    onSave,
    () => properties.copyPropertiesToMode.value
  );

  // Return the public API
  return {
    currentFocus,
    updateLyrics: updateLyricsWithFocus,
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
    copyPropertiesToMode: properties.copyPropertiesToMode,
    sourcePosition: properties.sourcePosition,
    toggleCopyPropertiesToMode: () => properties.toggleCopyPropertiesToMode(currentFocus.value),
    exitCopyPropertiesToMode: properties.exitCopyPropertiesToMode,
    copyPropertiesToVerse: (targetPosition: FocusPosition) =>
      properties.copyPropertiesToVerse(targetPosition),
    getCurrentVerseComment: () => properties.getCurrentVerseComment(currentFocus.value),
    setCurrentVerseComment: (comment: string | undefined) =>
      properties.setCurrentVerseComment(currentFocus.value, comment)
  };
}
