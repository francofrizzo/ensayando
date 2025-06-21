import type { LyricStanza, LyricVerse } from "@/data/types";
import { computed, nextTick, onMounted, onUnmounted, ref, type Ref } from "vue";
import { useCommands, type Command } from "./useCommands";

export interface FocusPosition {
  stanzaIndex: number;
  itemIndex: number;
  columnIndex?: number;
  lineIndex?: number;
}

export function useLyricsEditor(
  lyrics: Ref<LyricStanza[]>,
  updateLyrics: (newLyrics: LyricStanza[]) => void,
  onSave?: () => void,
  getCurrentTime?: () => number
) {
  const currentFocus = ref<FocusPosition | null>(null);
  const showHelp = ref(false);

  const getCurrentVerse = (position: FocusPosition): LyricVerse | null => {
    if (isColumnContext(position)) {
      const item = getItemAtPosition(position);
      if (Array.isArray(item)) {
        return item[position.columnIndex]?.[position.lineIndex] || null;
      }
    } else {
      const verse = getItemAtPosition(position);
      if (verse && !Array.isArray(verse)) {
        return verse;
      }
    }
    return null;
  };

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

  const getVerseText = (position: FocusPosition): string => {
    const verse = getCurrentVerse(position);
    return verse?.text || "";
  };

  const getInputElement = (position: FocusPosition): HTMLInputElement | null => {
    const { stanzaIndex, itemIndex } = position;
    let selector = `[data-input="${stanzaIndex}-${itemIndex}`;

    if (isColumnContext(position)) {
      selector += `-${position.columnIndex}-${position.lineIndex}`;
    }
    selector += '"]';

    return document.querySelector<HTMLInputElement>(selector);
  };

  const focusInput = async (position: FocusPosition) => {
    currentFocus.value = position;
    await nextTick();
    const element = getInputElement(position);
    if (element) {
      element.focus();
    }
  };

  const isColumnContext = (
    position: FocusPosition
  ): position is FocusPosition & { columnIndex: number; lineIndex: number } => {
    return position.columnIndex !== undefined && position.lineIndex !== undefined;
  };

  const getItemAtPosition = (
    position: FocusPosition,
    lyricsState: LyricStanza[] = lyrics.value
  ): LyricVerse | LyricVerse[][] | null => {
    const stanza = lyricsState[position.stanzaIndex];
    return stanza?.[position.itemIndex] || null;
  };

  const getLastPositionInItem = (
    item: LyricVerse | LyricVerse[][] | undefined,
    stanzaIndex: number,
    itemIndex: number
  ): FocusPosition | null => {
    if (!item) return null;

    if (Array.isArray(item)) {
      const columns = item as LyricVerse[][];
      const lastColumn = columns.length - 1;
      const lastLine = columns[lastColumn]?.length ? columns[lastColumn].length - 1 : 0;
      return {
        stanzaIndex,
        itemIndex,
        columnIndex: lastColumn,
        lineIndex: lastLine
      };
    } else {
      return { stanzaIndex, itemIndex };
    }
  };

  const getFirstPositionInItem = (
    item: LyricVerse | LyricVerse[][] | undefined,
    stanzaIndex: number,
    itemIndex: number
  ): FocusPosition | null => {
    if (!item) return null;

    if (Array.isArray(item)) {
      return {
        stanzaIndex,
        itemIndex,
        columnIndex: 0,
        lineIndex: 0
      };
    } else {
      return { stanzaIndex, itemIndex };
    }
  };

  // Unified navigation function that works with any lyrics state
  const findNavigationPosition = (
    current: FocusPosition,
    direction: "up" | "down" | "left" | "right",
    lyricsState: LyricStanza[] = lyrics.value
  ): FocusPosition | null => {
    const { stanzaIndex, itemIndex } = current;

    // Horizontal navigation
    if (direction === "left" || direction === "right") {
      // Horizontal navigation (only works in column context)
      if (!isColumnContext(current)) return null;

      // TypeScript now knows columnIndex and lineIndex are defined
      const stanza = lyricsState[stanzaIndex];
      if (!stanza) return null;

      const item = stanza[itemIndex] as LyricVerse[][];
      if (!Array.isArray(item)) return null;

      if (direction === "right") {
        // Move to next column
        if (current.columnIndex + 1 < item.length) {
          const nextColumn = item[current.columnIndex + 1];
          if (nextColumn) {
            const targetLineIndex = Math.min(current.lineIndex, nextColumn.length - 1);
            return {
              stanzaIndex,
              itemIndex,
              columnIndex: current.columnIndex + 1,
              lineIndex: targetLineIndex
            };
          }
        }
      } else {
        // Move to previous column
        if (current.columnIndex > 0) {
          const prevColumn = item[current.columnIndex - 1];
          if (prevColumn) {
            const targetLineIndex = Math.min(current.lineIndex, prevColumn.length - 1);
            return {
              stanzaIndex,
              itemIndex,
              columnIndex: current.columnIndex - 1,
              lineIndex: targetLineIndex
            };
          }
        }
      }
      return null;
    }

    // Vertical navigation
    if (direction === "down") {
      // Try to move to next line in same column
      if (isColumnContext(current)) {
        const item = lyricsState[stanzaIndex]?.[itemIndex];
        if (Array.isArray(item)) {
          const columns = item as LyricVerse[][];
          if (
            columns[current.columnIndex] &&
            current.lineIndex + 1 < columns[current.columnIndex]!.length
          ) {
            return {
              stanzaIndex,
              itemIndex,
              columnIndex: current.columnIndex,
              lineIndex: current.lineIndex + 1
            };
          }
        }
      }

      // Try to move to next item in same stanza
      const stanza = lyricsState[stanzaIndex];
      if (stanza && itemIndex + 1 < stanza.length) {
        const nextItem = stanza[itemIndex + 1];
        const position = getFirstPositionInItem(nextItem, stanzaIndex, itemIndex + 1);
        if (position) return position;
      }

      // Try to move to first item of next stanza
      if (stanzaIndex + 1 < lyricsState.length) {
        const nextStanza = lyricsState[stanzaIndex + 1];
        if (nextStanza && nextStanza.length > 0) {
          const firstItem = nextStanza[0];
          const position = getFirstPositionInItem(firstItem, stanzaIndex + 1, 0);
          if (position) return position;
        }
      }
    } else {
      // direction === "up"
      // Try to move to previous line in same column
      if (isColumnContext(current) && current.lineIndex > 0) {
        return {
          stanzaIndex,
          itemIndex,
          columnIndex: current.columnIndex,
          lineIndex: current.lineIndex - 1
        };
      }

      // Try to move to previous item in same stanza
      if (itemIndex > 0) {
        const stanza = lyricsState[stanzaIndex];
        if (!stanza) return null;
        const prevItem = stanza[itemIndex - 1];
        const position = getLastPositionInItem(prevItem, stanzaIndex, itemIndex - 1);
        if (position) return position;
      }

      // Try to move to last item of previous stanza
      if (stanzaIndex > 0) {
        const prevStanza = lyricsState[stanzaIndex - 1];
        if (prevStanza && prevStanza.length > 0) {
          const lastItem = prevStanza[prevStanza.length - 1];
          const position = getLastPositionInItem(lastItem, stanzaIndex - 1, prevStanza.length - 1);
          if (position) return position;
        }
      }
    }

    return null;
  };

  // Simple wrapper for regular navigation
  const findNextPosition = (
    current: FocusPosition,
    direction: "up" | "down" | "left" | "right"
  ): FocusPosition | null => {
    return findNavigationPosition(current, direction);
  };

  // Simple function to find a good position after deletion using actual post-deletion state
  const findPositionAfterDeletion = (originalPosition: FocusPosition): FocusPosition | null => {
    const { stanzaIndex, itemIndex } = originalPosition;

    // Handle column context specially
    if (isColumnContext(originalPosition)) {
      const { columnIndex, lineIndex } = originalPosition;
      const currentStanza = lyrics.value[stanzaIndex];
      const item = currentStanza?.[itemIndex];

      if (Array.isArray(item)) {
        const column = item[columnIndex];
        if (column && column.length > 0) {
          // Column still exists and has content
          if (lineIndex > 0 && column[lineIndex - 1]) {
            // Focus previous line in same column
            return { stanzaIndex, itemIndex, columnIndex, lineIndex: lineIndex - 1 };
          } else if (column[lineIndex]) {
            // Focus current line index (something moved up)
            return { stanzaIndex, itemIndex, columnIndex, lineIndex };
          } else if (column[0]) {
            // Focus first line in column
            return { stanzaIndex, itemIndex, columnIndex, lineIndex: 0 };
          }
        }

        // Column was deleted or is empty, try to find another column
        if (columnIndex > 0 && item[columnIndex - 1]) {
          const prevColumn = item[columnIndex - 1];
          if (prevColumn) {
            const lastLineIndex = prevColumn.length - 1;
            return {
              stanzaIndex,
              itemIndex,
              columnIndex: columnIndex - 1,
              lineIndex: lastLineIndex
            };
          }
        } else if (item[columnIndex]) {
          // Next column moved to current index
          return { stanzaIndex, itemIndex, columnIndex, lineIndex: 0 };
        } else if (item[0]) {
          // Focus first column
          return { stanzaIndex, itemIndex, columnIndex: 0, lineIndex: 0 };
        }

        // All columns were deleted, fall through to regular item logic
      } else if (item) {
        // Item was converted from column to regular verse - focus the regular verse
        return { stanzaIndex, itemIndex };
      }
    }

    // Regular item context or fallback from column context
    const currentStanza = lyrics.value[stanzaIndex];

    if (!currentStanza || currentStanza.length === 0) {
      // Stanza was deleted or is empty, try to go to previous or next stanza
      if (stanzaIndex > 0) {
        const prevStanza = lyrics.value[stanzaIndex - 1];
        if (prevStanza && prevStanza.length > 0) {
          const lastItemIndex = prevStanza.length - 1;
          const lastItem = prevStanza[lastItemIndex];
          return getLastPositionInItem(lastItem, stanzaIndex - 1, lastItemIndex);
        }
      } else if (lyrics.value[stanzaIndex]) {
        // Next stanza moved to current index
        const nextStanza = lyrics.value[stanzaIndex];
        if (nextStanza.length > 0) {
          const firstItem = nextStanza[0];
          return getFirstPositionInItem(firstItem, stanzaIndex, 0);
        }
      }
      return null;
    }

    // Stanza still exists, try to find a good position
    // First priority: try to focus the previous item
    if (itemIndex > 0 && currentStanza[itemIndex - 1]) {
      const prevItem = currentStanza[itemIndex - 1];
      return getLastPositionInItem(prevItem, stanzaIndex, itemIndex - 1);
    } else if (itemIndex < currentStanza.length) {
      // Second priority: item at same index exists (something after the deleted item)
      const targetItem = currentStanza[itemIndex];
      return getFirstPositionInItem(targetItem, stanzaIndex, itemIndex);
    } else if (currentStanza[0]) {
      // Last resort: focus the first item in the stanza
      const firstItem = currentStanza[0];
      return getFirstPositionInItem(firstItem, stanzaIndex, 0);
    }

    return null;
  };

  const navigateHorizontal = (direction: "left" | "right") => {
    if (!currentFocus.value) return;

    const nextPosition = findNextPosition(currentFocus.value, direction);
    if (nextPosition) {
      focusInput(nextPosition);
    }
  };

  const navigateVertical = (direction: "up" | "down") => {
    if (!currentFocus.value) return;

    const nextPosition = findNextPosition(currentFocus.value, direction);
    if (nextPosition) {
      focusInput(nextPosition);
    }
  };

  const insertLine = (before: boolean = false) => {
    if (!currentFocus.value) return;

    const { stanzaIndex, itemIndex } = currentFocus.value;
    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    if (isColumnContext(currentFocus.value)) {
      // Insert within column context
      const { columnIndex, lineIndex } = currentFocus.value;
      const item = getItemAtPosition(currentFocus.value, currentLyrics);

      if (Array.isArray(item) && item[columnIndex]) {
        const targetColumn = item[columnIndex];
        if (targetColumn) {
          const newVerse: LyricVerse = {
            text: "",
            start_time: undefined,
            end_time: undefined
          };

          if (before) {
            targetColumn.splice(lineIndex, 0, newVerse);
            updateLyrics(currentLyrics);
            // Focus the newly inserted line
            focusInput({ stanzaIndex, itemIndex, columnIndex, lineIndex });
          } else {
            targetColumn.splice(lineIndex + 1, 0, newVerse);
            updateLyrics(currentLyrics);
            // Focus the newly inserted line
            focusInput({ stanzaIndex, itemIndex, columnIndex, lineIndex: lineIndex + 1 });
          }
        }
      }
    } else {
      // Insert regular verse (outside column context)
      const newVerse: LyricVerse = {
        text: "",
        start_time: undefined,
        end_time: undefined
      };

      if (before) {
        stanza.splice(itemIndex, 0, newVerse);
        updateLyrics(currentLyrics);
        // Focus the newly inserted line
        focusInput({ stanzaIndex, itemIndex });
      } else {
        stanza.splice(itemIndex + 1, 0, newVerse);
        updateLyrics(currentLyrics);
        // Focus the newly inserted line
        focusInput({ stanzaIndex, itemIndex: itemIndex + 1 });
      }
    }
  };

  const deleteLine = () => {
    if (!currentFocus.value) return;

    const { stanzaIndex, itemIndex } = currentFocus.value;
    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    if (isColumnContext(currentFocus.value)) {
      // Delete from column
      const item = getItemAtPosition(currentFocus.value, currentLyrics);
      if (Array.isArray(item) && item[currentFocus.value.columnIndex]) {
        const targetColumn = item[currentFocus.value.columnIndex];
        if (targetColumn) {
          targetColumn.splice(currentFocus.value.lineIndex, 1);

          // If column is empty, remove it
          if (targetColumn.length === 0) {
            item.splice(currentFocus.value.columnIndex, 1);

            // If all columns are empty, remove the entire item
            if (item.length === 0) {
              stanza.splice(itemIndex, 1);
            } else if (item.length === 1) {
              // If only one column remains, convert back to regular verse
              const remainingColumn = item[0];
              if (remainingColumn && remainingColumn.length === 1) {
                // Single verse in single column - convert to regular verse
                const singleVerse = remainingColumn[0];
                if (singleVerse) {
                  stanza[itemIndex] = singleVerse;
                }
              } else if (remainingColumn && remainingColumn.length > 1) {
                // Multiple verses in single column - keep as column for now
                // (This preserves the structure when there are multiple lines in the remaining column)
              }
            }
          }
        }
      }
    } else {
      // Delete regular verse
      stanza.splice(itemIndex, 1);

      // If stanza is empty after deletion, remove it
      if (stanza.length === 0) {
        currentLyrics.splice(stanzaIndex, 1);
      }
    }

    updateLyrics(currentLyrics);

    // Find a good position to focus after deletion
    const nextPosition = findPositionAfterDeletion(currentFocus.value);
    if (nextPosition) {
      focusInput(nextPosition);
    }
  };

  const convertToColumns = () => {
    if (!currentFocus.value) return;

    const { stanzaIndex, itemIndex } = currentFocus.value;
    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    const currentItem = stanza[itemIndex];

    // Only convert if it's not already in column format
    if (Array.isArray(currentItem)) return;

    const verse = currentItem as LyricVerse;
    // Create two columns: first with the original verse, second empty
    const newColumns: LyricVerse[][] = [
      [{ ...verse }], // Original verse in first column
      [{ text: "" }] // Empty verse in second column
    ];

    stanza[itemIndex] = newColumns;
    updateLyrics(currentLyrics);

    // Focus the empty column on the right so user can start typing
    focusInput({ stanzaIndex, itemIndex, columnIndex: 1, lineIndex: 0 });
  };

  const insertColumn = (before: boolean = false) => {
    if (!currentFocus.value) return;

    const { stanzaIndex, itemIndex } = currentFocus.value;

    if (!isColumnContext(currentFocus.value)) return;

    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    const item = stanza[itemIndex] as LyricVerse[][];
    if (!Array.isArray(item)) return;

    const newColumn: LyricVerse[] = [{ text: "", start_time: undefined, end_time: undefined }];

    if (before) {
      item.splice(currentFocus.value.columnIndex, 0, newColumn);
      updateLyrics(currentLyrics);
      focusInput({
        stanzaIndex,
        itemIndex,
        columnIndex: currentFocus.value.columnIndex,
        lineIndex: 0
      });
    } else {
      item.splice(currentFocus.value.columnIndex + 1, 0, newColumn);
      updateLyrics(currentLyrics);
      focusInput({
        stanzaIndex,
        itemIndex,
        columnIndex: currentFocus.value.columnIndex + 1,
        lineIndex: 0
      });
    }
  };

  const insertStanza = () => {
    if (!currentFocus.value) return;

    const { stanzaIndex } = currentFocus.value;
    const currentLyrics = [...lyrics.value];

    const newStanza: LyricStanza = [{ text: "", start_time: undefined, end_time: undefined }];

    currentLyrics.splice(stanzaIndex + 1, 0, newStanza);
    updateLyrics(currentLyrics);

    // Focus the first item of the new stanza
    focusInput({ stanzaIndex: stanzaIndex + 1, itemIndex: 0 });
  };

  const insertLineOutsideColumn = (before: boolean = false) => {
    if (!currentFocus.value) return;

    const { stanzaIndex, itemIndex } = currentFocus.value;
    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    const newVerse: LyricVerse = {
      text: "",
      start_time: undefined,
      end_time: undefined
    };

    if (before) {
      stanza.splice(itemIndex, 0, newVerse);
      updateLyrics(currentLyrics);
      focusInput({ stanzaIndex, itemIndex });
    } else {
      stanza.splice(itemIndex + 1, 0, newVerse);
      updateLyrics(currentLyrics);
      focusInput({ stanzaIndex, itemIndex: itemIndex + 1 });
    }
  };

  const duplicateLine = () => {
    if (!currentFocus.value) return;

    const { stanzaIndex, itemIndex } = currentFocus.value;
    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    if (isColumnContext(currentFocus.value)) {
      // Duplicate in column context
      const item = getItemAtPosition(currentFocus.value, currentLyrics);
      if (
        Array.isArray(item) &&
        item[currentFocus.value.columnIndex] &&
        item[currentFocus.value.columnIndex]![currentFocus.value.lineIndex]
      ) {
        const originalVerse = item[currentFocus.value.columnIndex]![currentFocus.value.lineIndex];
        if (originalVerse) {
          const duplicatedVerse: LyricVerse = {
            text: originalVerse.text,
            start_time: originalVerse.start_time,
            end_time: originalVerse.end_time,
            comment: originalVerse.comment,
            audio_track_ids: originalVerse.audio_track_ids
              ? [...originalVerse.audio_track_ids]
              : undefined,
            color_keys: originalVerse.color_keys ? [...originalVerse.color_keys] : undefined
          };
          const targetColumn = item[currentFocus.value.columnIndex];
          if (targetColumn) {
            targetColumn.splice(currentFocus.value.lineIndex + 1, 0, duplicatedVerse);
          }
          updateLyrics(currentLyrics);
          focusInput({
            stanzaIndex,
            itemIndex,
            columnIndex: currentFocus.value.columnIndex,
            lineIndex: currentFocus.value.lineIndex + 1
          });
        }
      }
    } else {
      // Duplicate regular verse
      const originalVerse = stanza[itemIndex] as LyricVerse;
      if (originalVerse) {
        const duplicatedVerse = { ...originalVerse };
        stanza.splice(itemIndex + 1, 0, duplicatedVerse);
        updateLyrics(currentLyrics);
        focusInput({ stanzaIndex, itemIndex: itemIndex + 1 });
      }
    }
  };

  const handleSmartBackspace = (): boolean => {
    if (!currentFocus.value) return false;

    const currentText = getVerseText(currentFocus.value);

    // Only delete if the text is empty
    if (currentText === "") {
      deleteLine();
      return true;
    }

    return false;
  };

  const setCurrentVerseStartTime = () => {
    if (!currentFocus.value || !getCurrentTime) return;

    const currentTime = getCurrentTime();
    updateCurrentVerse(currentFocus.value, (verse) => {
      verse.start_time = currentTime;
    });
  };

  const setCurrentVerseEndTime = () => {
    if (!currentFocus.value || !getCurrentTime) return;

    const currentTime = getCurrentTime();
    updateCurrentVerse(currentFocus.value, (verse) => {
      verse.end_time = currentTime;
    });
  };

  const adjustCurrentVerseStartTime = (deltaSeconds: number) => {
    if (!currentFocus.value) return;

    updateCurrentVerse(currentFocus.value, (verse) => {
      if (verse.start_time !== undefined) {
        verse.start_time = Math.max(0, verse.start_time + deltaSeconds);
      }
    });
  };

  const adjustCurrentVerseEndTime = (deltaSeconds: number) => {
    if (!currentFocus.value) return;

    updateCurrentVerse(currentFocus.value, (verse) => {
      if (verse.end_time !== undefined) {
        verse.end_time = Math.max(0, verse.end_time + deltaSeconds);
      }
    });
  };

  const clearCurrentVerseStartTime = () => {
    if (!currentFocus.value) return;

    updateCurrentVerse(currentFocus.value, (verse) => {
      verse.start_time = undefined;
    });
  };

  const clearCurrentVerseEndTime = () => {
    if (!currentFocus.value) return;

    updateCurrentVerse(currentFocus.value, (verse) => {
      verse.end_time = undefined;
    });
  };

  const clearCurrentVerseBothTimes = () => {
    if (!currentFocus.value) return;

    updateCurrentVerse(currentFocus.value, (verse) => {
      verse.start_time = undefined;
      verse.end_time = undefined;
    });
  };

  const getColorsForInheritance = (): string[] => {
    if (!currentFocus.value) return [];
    const verse = getCurrentVerse(currentFocus.value);
    return verse?.color_keys || [];
  };

  const getAudioTrackIdsForInheritance = (): number[] => {
    if (!currentFocus.value) return [];
    const verse = getCurrentVerse(currentFocus.value);
    return verse?.audio_track_ids || [];
  };

  const getCurrentVerseColors = (): string[] => {
    if (!currentFocus.value) return [];
    const verse = getCurrentVerse(currentFocus.value);
    return verse?.color_keys || [];
  };

  const setCurrentVerseColors = (colors: string[]) => {
    if (!currentFocus.value) return;

    updateCurrentVerse(currentFocus.value, (verse) => {
      if (colors.length === 0) {
        delete verse.color_keys;
      } else {
        verse.color_keys = colors;
      }
    });
  };

  const getCurrentVerseAudioTrackIds = (): number[] => {
    if (!currentFocus.value) return [];
    const verse = getCurrentVerse(currentFocus.value);
    return verse?.audio_track_ids || [];
  };

  const setCurrentVerseAudioTrackIds = (trackIds: number[]) => {
    if (!currentFocus.value) return;

    updateCurrentVerse(currentFocus.value, (verse) => {
      if (trackIds.length === 0) {
        delete verse.audio_track_ids;
      } else {
        verse.audio_track_ids = trackIds;
      }
    });
  };

  const copyPropertiesFromMode = ref(false);

  const toggleCopyPropertiesFromMode = () => {
    copyPropertiesFromMode.value = !copyPropertiesFromMode.value;
  };

  const copyPropertiesFromVerse = (sourcePosition: FocusPosition) => {
    if (!currentFocus.value || !copyPropertiesFromMode.value) return;

    // Store the original focus to restore later
    const originalFocus = { ...currentFocus.value };

    const sourceVerse = getCurrentVerse(sourcePosition);
    if (!sourceVerse) return;

    const sourceColors = sourceVerse.color_keys || [];
    const sourceTrackIds = sourceVerse.audio_track_ids || [];

    // Apply both colors and track IDs to the current verse
    setCurrentVerseColors([...sourceColors]);
    setCurrentVerseAudioTrackIds([...sourceTrackIds]);

    // Exit copy mode after copying
    copyPropertiesFromMode.value = false;

    // Restore focus to the original verse
    nextTick(() => {
      focusInput(originalFocus);
    });
  };

  const insertLineWithInheritance = (before: boolean = false) => {
    const colorsToInherit = getColorsForInheritance();
    const trackIdsToInherit = getAudioTrackIdsForInheritance();
    insertLine(before);

    // Apply inherited colors and track IDs to the newly created line
    nextTick(() => {
      if (colorsToInherit.length > 0) {
        setCurrentVerseColors(colorsToInherit);
      }
      if (trackIdsToInherit.length > 0) {
        setCurrentVerseAudioTrackIds(trackIdsToInherit);
      }
    });
  };

  const duplicateLineWithInheritance = () => {
    duplicateLine();
  };

  const commandRegistry = useCommands();
  const canPerformActions = computed(() => currentFocus.value !== null);
  const hasColumnContext = computed(() =>
    currentFocus.value ? isColumnContext(currentFocus.value) : false
  );

  const commands: Command[] = [
    {
      id: "navigate-up",
      description: "Navegar hacia arriba",
      category: "Navegación",
      execute: () => navigateVertical("up"),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "ArrowUp"
      }
    },
    {
      id: "navigate-down",
      description: "Navegar hacia abajo",
      category: "Navegación",
      execute: () => navigateVertical("down"),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "ArrowDown"
      }
    },
    {
      id: "navigate-left",
      description: "Moverse dentro del texto / Navegar entre columnas",
      category: "Navegación",
      execute: () => navigateHorizontal("left"),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "ArrowLeft",
        preventDefault: false
      }
    },
    {
      id: "navigate-right",
      description: "Moverse dentro del texto / Navegar entre columnas",
      category: "Navegación",
      execute: () => navigateHorizontal("right"),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "ArrowRight",
        preventDefault: false
      }
    },

    {
      id: "insert-line",
      description: "Insertar nuevo verso después del actual",
      category: "Operaciones de versos",
      execute: () => insertLineWithInheritance(false),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "Enter"
      }
    },
    {
      id: "insert-line-before",
      description: "Insertar nuevo verso antes del actual",
      category: "Operaciones de versos",
      execute: () => insertLineWithInheritance(true),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "Enter",
        modifiers: { alt: true }
      }
    },
    {
      id: "insert-line-outside-after",
      description: "Insertar verso fuera de columnas (después)",
      category: "Operaciones de versos",
      execute: () => insertLineOutsideColumn(false),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "Enter",
        modifiers: { shift: true }
      }
    },
    {
      id: "insert-line-outside-before",
      description: "Insertar verso fuera de columnas (antes)",
      category: "Operaciones de versos",
      execute: () => insertLineOutsideColumn(true),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "Enter",
        modifiers: { shift: true, alt: true }
      }
    },
    {
      id: "delete-line",
      description: "Eliminar verso actual",
      category: "Operaciones de versos",
      execute: () => deleteLine(),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "Backspace",
        modifiers: { ctrl: true }
      }
    },
    {
      id: "smart-backspace",
      description: "Eliminar verso vacío automáticamente",
      category: "Operaciones de versos",
      execute: () => {
        const handled = handleSmartBackspace();
        // If we handled the deletion, we should prevent default to avoid double deletion
        return handled;
      },
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "Backspace"
        // Don't set preventDefault: false - let the command system handle it based on return value
      }
    },
    {
      id: "duplicate-line",
      description: "Duplicar verso actual",
      category: "Operaciones de versos",
      execute: () => duplicateLineWithInheritance(),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "d",
        modifiers: { ctrl: true }
      }
    },
    {
      id: "copy-properties",
      description: "Copiar colores y pistas de audio de otro verso",
      category: "Operaciones de versos",
      execute: () => toggleCopyPropertiesFromMode(),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "k",
        modifiers: { ctrl: true }
      }
    },

    {
      id: "convert-to-columns",
      description: "Convertir en un verso con múltiples columnas",
      category: "Operaciones de columnas",
      execute: () => convertToColumns(),
      canExecute: () => canPerformActions.value && !hasColumnContext.value,
      keybinding: {
        key: "]",
        modifiers: { ctrl: true }
      }
    },
    {
      id: "insert-column-right",
      description: "Insertar columna a la derecha",
      category: "Operaciones de columnas",
      execute: () => insertColumn(false),
      canExecute: () => canPerformActions.value && hasColumnContext.value,
      keybinding: {
        key: "]",
        modifiers: { ctrl: true }
      }
    },
    {
      id: "insert-column-left",
      description: "Insertar columna a la izquierda",
      category: "Operaciones de columnas",
      execute: () => insertColumn(true),
      canExecute: () => canPerformActions.value && hasColumnContext.value,
      keybinding: {
        key: "[",
        modifiers: { ctrl: true }
      }
    },

    {
      id: "insert-stanza",
      description: "Insertar nueva estrofa",
      category: "Operaciones de estrofas",
      execute: () => insertStanza(),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "Enter",
        modifiers: { ctrl: true }
      }
    },

    {
      id: "set-start-time",
      description: "Establecer tiempo de inicio del verso",
      category: "Marcas de tiempo",
      execute: () => setCurrentVerseStartTime(),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: ",",
        modifiers: { ctrl: true }
      }
    },
    {
      id: "set-end-time",
      description: "Establecer tiempo de finalización del verso",
      category: "Marcas de tiempo",
      execute: () => setCurrentVerseEndTime(),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: ".",
        modifiers: { ctrl: true }
      }
    },
    {
      id: "clear-start-time",
      description: "Limpiar tiempo de inicio",
      category: "Marcas de tiempo",
      execute: () => clearCurrentVerseStartTime(),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: ",",
        modifiers: { ctrl: true, shift: true }
      }
    },
    {
      id: "clear-end-time",
      description: "Limpiar tiempo de finalización",
      category: "Marcas de tiempo",
      execute: () => clearCurrentVerseEndTime(),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: ".",
        modifiers: { ctrl: true, shift: true }
      }
    },
    {
      id: "clear-both-times",
      description: "Limpiar ambos tiempos",
      category: "Marcas de tiempo",
      execute: () => clearCurrentVerseBothTimes(),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "/",
        modifiers: { ctrl: true }
      }
    },
    {
      id: "adjust-start-time-forward",
      description: "Ajustar tiempo de inicio hacia adelante",
      category: "Marcas de tiempo",
      execute: () => adjustCurrentVerseStartTime(0.1),
      canExecute: () => canPerformActions.value
    },
    {
      id: "adjust-start-time-backward",
      description: "Ajustar tiempo de inicio hacia atrás",
      category: "Marcas de tiempo",
      execute: () => adjustCurrentVerseStartTime(-0.1),
      canExecute: () => canPerformActions.value
    },
    {
      id: "adjust-end-time-forward",
      description: "Ajustar tiempo final hacia adelante",
      category: "Marcas de tiempo",
      execute: () => adjustCurrentVerseEndTime(0.1),
      canExecute: () => canPerformActions.value
    },
    {
      id: "adjust-end-time-backward",
      description: "Ajustar tiempo final hacia atrás",
      category: "Marcas de tiempo",
      execute: () => adjustCurrentVerseEndTime(-0.1),
      canExecute: () => canPerformActions.value
    },

    {
      id: "save",
      description: "Guardar cambios",
      category: "Acciones rápidas",
      execute: () => onSave?.(),
      canExecute: () => !!onSave,
      keybinding: {
        key: "s",
        modifiers: { ctrl: true }
      }
    },
    {
      id: "toggle-help",
      description: "Mostrar/ocultar esta ayuda",
      category: "Acciones rápidas",
      execute: () => {
        showHelp.value = !showHelp.value;
      },
      keybinding: {
        key: "F1"
      }
    }
  ];

  commands.forEach((command) => {
    commandRegistry.register(command);
  });

  const handleKeydown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;

    if (!target.hasAttribute("data-input")) return;

    commandRegistry.handleKeyboardEvent(event);
  };

  const handleInputFocus = (position: FocusPosition) => {
    currentFocus.value = position;
  };

  onMounted(() => {
    document.addEventListener("keydown", handleKeydown);
  });

  onUnmounted(() => {
    document.removeEventListener("keydown", handleKeydown);
  });

  return {
    currentFocus: computed(() => currentFocus.value),
    showHelp,
    handleInputFocus,
    focusInput,

    commandRegistry,

    getCurrentVerseColors,
    setCurrentVerseColors,
    getCurrentVerseAudioTrackIds,
    setCurrentVerseAudioTrackIds,
    copyPropertiesFromMode: computed(() => copyPropertiesFromMode.value),
    copyPropertiesFromVerse
  };
}
