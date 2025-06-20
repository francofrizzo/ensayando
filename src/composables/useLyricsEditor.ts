import type { LyricStanza, LyricVerse } from "@/data/types";
import { computed, nextTick, onMounted, onUnmounted, ref, type Ref } from "vue";

export interface FocusPosition {
  stanzaIndex: number;
  itemIndex: number;
  columnIndex?: number;
  lineIndex?: number;
}

export function useLyricsEditor(
  lyrics: Ref<LyricStanza[]>,
  updateLyrics: (newLyrics: LyricStanza[]) => void,
  onSave?: () => void
) {
  const currentFocus = ref<FocusPosition | null>(null);
  const showHelp = ref(false);

  // Get input element for a given position
  const getInputElement = (position: FocusPosition): HTMLInputElement | null => {
    const { stanzaIndex, itemIndex, columnIndex, lineIndex } = position;
    let selector = `[data-input="${stanzaIndex}-${itemIndex}`;

    if (columnIndex !== undefined && lineIndex !== undefined) {
      selector += `-${columnIndex}-${lineIndex}`;
    }
    selector += '"]';

    return document.querySelector<HTMLInputElement>(selector);
  };

  // Focus an input element
  const focusInput = async (position: FocusPosition) => {
    currentFocus.value = position;
    await nextTick();
    const element = getInputElement(position);
    if (element) {
      element.focus();
    }
  };

  // Navigate between columns horizontally
  const navigateHorizontal = (direction: "left" | "right") => {
    if (!currentFocus.value) return;

    const { stanzaIndex, itemIndex, columnIndex, lineIndex } = currentFocus.value;

    // Only works in column context
    if (columnIndex === undefined) return;

    const currentLyrics = lyrics.value;
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    const item = stanza[itemIndex] as LyricVerse[][];
    if (!Array.isArray(item)) return;

    if (direction === "right") {
      // Move to next column
      if (columnIndex + 1 < item.length) {
        const nextColumn = item[columnIndex + 1];
        if (nextColumn) {
          const targetLineIndex = Math.min(lineIndex || 0, nextColumn.length - 1);
          focusInput({
            stanzaIndex,
            itemIndex,
            columnIndex: columnIndex + 1,
            lineIndex: targetLineIndex
          });
        }
      }
    } else {
      // Move to previous column
      if (columnIndex > 0) {
        const prevColumn = item[columnIndex - 1];
        if (prevColumn) {
          const targetLineIndex = Math.min(lineIndex || 0, prevColumn.length - 1);
          focusInput({
            stanzaIndex,
            itemIndex,
            columnIndex: columnIndex - 1,
            lineIndex: targetLineIndex
          });
        }
      }
    }
  };

  // Navigate to next/previous input
  const navigateVertical = (direction: "up" | "down") => {
    if (!currentFocus.value) return;

    const { stanzaIndex, itemIndex, columnIndex, lineIndex } = currentFocus.value;
    const currentLyrics = lyrics.value;

    if (direction === "down") {
      // Try to move to next line in same column
      if (columnIndex !== undefined && lineIndex !== undefined) {
        const stanza = currentLyrics[stanzaIndex];
        if (stanza && Array.isArray(stanza[itemIndex])) {
          const columns = stanza[itemIndex] as LyricVerse[][];
          if (columns[columnIndex] && lineIndex + 1 < columns[columnIndex].length) {
            focusInput({ stanzaIndex, itemIndex, columnIndex, lineIndex: lineIndex + 1 });
            return;
          }
        }
      }

      // Try to move to next item in same stanza
      const stanza = currentLyrics[stanzaIndex];
      if (stanza && itemIndex + 1 < stanza.length) {
        const nextItem = stanza[itemIndex + 1];
        if (Array.isArray(nextItem)) {
          focusInput({ stanzaIndex, itemIndex: itemIndex + 1, columnIndex: 0, lineIndex: 0 });
        } else {
          focusInput({ stanzaIndex, itemIndex: itemIndex + 1 });
        }
        return;
      }

      // Try to move to first item of next stanza
      if (stanzaIndex + 1 < currentLyrics.length) {
        const nextStanza = currentLyrics[stanzaIndex + 1];
        if (nextStanza && nextStanza.length > 0) {
          const firstItem = nextStanza[0];
          if (Array.isArray(firstItem)) {
            focusInput({
              stanzaIndex: stanzaIndex + 1,
              itemIndex: 0,
              columnIndex: 0,
              lineIndex: 0
            });
          } else {
            focusInput({ stanzaIndex: stanzaIndex + 1, itemIndex: 0 });
          }
        }
      }
    } else {
      // Try to move to previous line in same column
      if (columnIndex !== undefined && lineIndex !== undefined && lineIndex > 0) {
        focusInput({ stanzaIndex, itemIndex, columnIndex, lineIndex: lineIndex - 1 });
        return;
      }

      // Try to move to previous item in same stanza
      if (itemIndex > 0) {
        const stanza = currentLyrics[stanzaIndex];
        if (!stanza) return;
        const prevItem = stanza[itemIndex - 1];
        if (Array.isArray(prevItem)) {
          const columns = prevItem as LyricVerse[][];
          const lastColumn = columns.length - 1;
          const lastLine = columns[lastColumn] ? columns[lastColumn].length - 1 : 0;
          focusInput({
            stanzaIndex,
            itemIndex: itemIndex - 1,
            columnIndex: lastColumn,
            lineIndex: lastLine
          });
        } else {
          focusInput({ stanzaIndex, itemIndex: itemIndex - 1 });
        }
        return;
      }

      // Try to move to last item of previous stanza
      if (stanzaIndex > 0) {
        const prevStanza = currentLyrics[stanzaIndex - 1];
        if (!prevStanza) return;
        const lastItemIndex = prevStanza.length - 1;
        if (lastItemIndex >= 0) {
          const lastItem = prevStanza[lastItemIndex];
          if (Array.isArray(lastItem)) {
            const columns = lastItem as LyricVerse[][];
            const lastColumn = columns.length - 1;
            const lastLine = columns[lastColumn] ? columns[lastColumn].length - 1 : 0;
            focusInput({
              stanzaIndex: stanzaIndex - 1,
              itemIndex: lastItemIndex,
              columnIndex: lastColumn,
              lineIndex: lastLine
            });
          } else {
            focusInput({ stanzaIndex: stanzaIndex - 1, itemIndex: lastItemIndex });
          }
        }
      }
    }
  };

  // Insert new verse/line
  const insertLine = (before: boolean = false) => {
    if (!currentFocus.value) return;

    const { stanzaIndex, itemIndex, columnIndex, lineIndex } = currentFocus.value;
    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];

    if (!stanza) return;

    const newVerse: LyricVerse = { text: "" };
    const insertIndex = before ? itemIndex : itemIndex + 1;

    if (columnIndex !== undefined && lineIndex !== undefined) {
      // Inserting in a column
      const item = stanza[itemIndex] as LyricVerse[][];
      const column = item[columnIndex];
      if (!column) return;
      const newLineIndex = before ? lineIndex : lineIndex + 1;
      column.splice(newLineIndex, 0, newVerse);

      updateLyrics(currentLyrics);
      nextTick(() => {
        focusInput({ stanzaIndex, itemIndex, columnIndex, lineIndex: newLineIndex });
      });
    } else {
      // Inserting a regular verse
      stanza.splice(insertIndex, 0, newVerse);
      updateLyrics(currentLyrics);
      nextTick(() => {
        focusInput({ stanzaIndex, itemIndex: insertIndex });
      });
    }
  };

  // Delete current line
  const deleteLine = () => {
    if (!currentFocus.value) return;

    const { stanzaIndex, itemIndex, columnIndex, lineIndex } = currentFocus.value;
    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];

    if (!stanza) return;

    if (columnIndex !== undefined && lineIndex !== undefined) {
      // Deleting from a column
      const item = stanza[itemIndex] as LyricVerse[][];
      const column = item[columnIndex];
      if (!column) return;

      if (column.length <= 1) {
        // Delete the entire column if it has only one verse
        item.splice(columnIndex, 1);

        // If only one column remains, convert back to flat shape
        if (item.length === 1) {
          const remainingColumn = item[0];
          if (remainingColumn && remainingColumn.length === 1) {
            const remainingVerse = remainingColumn[0];
            if (remainingVerse) {
              stanza[itemIndex] = remainingVerse;
              updateLyrics(currentLyrics);
              nextTick(() => {
                focusInput({ stanzaIndex, itemIndex });
              });
              return;
            }
          }
        }

        updateLyrics(currentLyrics);
        // Focus the previous column or first column if we deleted the first one
        const newColumnIndex = columnIndex > 0 ? columnIndex - 1 : 0;
        const targetColumn = item[newColumnIndex];
        if (targetColumn) {
          const targetLineIndex = Math.min(lineIndex, targetColumn.length - 1);
          nextTick(() => {
            focusInput({
              stanzaIndex,
              itemIndex,
              columnIndex: newColumnIndex,
              lineIndex: targetLineIndex
            });
          });
        }
        return;
      }

      column.splice(lineIndex, 1);
      updateLyrics(currentLyrics);

      // Focus previous line or next line if at beginning
      const newLineIndex = lineIndex > 0 ? lineIndex - 1 : 0;
      nextTick(() => {
        focusInput({ stanzaIndex, itemIndex, columnIndex, lineIndex: newLineIndex });
      });
    } else {
      // Deleting a regular verse
      if (stanza.length <= 1) {
        // Delete the entire stanza if it has only one verse
        if (currentLyrics.length <= 1) {
          // Don't delete the last stanza, just clear its content
          stanza[0] = { text: "" };
          updateLyrics(currentLyrics);
          nextTick(() => {
            focusInput({ stanzaIndex, itemIndex: 0 });
          });
          return;
        }

        currentLyrics.splice(stanzaIndex, 1);
        updateLyrics(currentLyrics);

        // Focus the previous stanza or next stanza if we deleted the first one
        const newStanzaIndex = stanzaIndex > 0 ? stanzaIndex - 1 : 0;
        const targetStanza = currentLyrics[newStanzaIndex];
        if (targetStanza && targetStanza.length > 0) {
          const targetItemIndex = stanzaIndex > 0 ? targetStanza.length - 1 : 0;
          const targetItem = targetStanza[targetItemIndex];

          nextTick(() => {
            if (Array.isArray(targetItem)) {
              focusInput({
                stanzaIndex: newStanzaIndex,
                itemIndex: targetItemIndex,
                columnIndex: 0,
                lineIndex: 0
              });
            } else {
              focusInput({ stanzaIndex: newStanzaIndex, itemIndex: targetItemIndex });
            }
          });
        }
        return;
      }

      stanza.splice(itemIndex, 1);
      updateLyrics(currentLyrics);

      // Focus previous item or next item if at beginning
      const newItemIndex = itemIndex > 0 ? itemIndex - 1 : 0;
      const newItem = stanza[newItemIndex];

      nextTick(() => {
        if (Array.isArray(newItem)) {
          focusInput({ stanzaIndex, itemIndex: newItemIndex, columnIndex: 0, lineIndex: 0 });
        } else {
          focusInput({ stanzaIndex, itemIndex: newItemIndex });
        }
      });
    }
  };

  // Convert regular verse to column layout
  const convertToColumns = () => {
    if (!currentFocus.value) return;

    const { stanzaIndex, itemIndex, columnIndex } = currentFocus.value;
    // Only works on regular verses (not already in column layout)
    if (columnIndex !== undefined) return;

    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    const currentVerse = stanza[itemIndex] as LyricVerse;
    if (Array.isArray(currentVerse)) return; // Already columns

    // Convert to column layout with two columns
    const newColumnLayout: LyricVerse[][] = [
      [
        {
          text: currentVerse.text,
          start_time: currentVerse.start_time,
          end_time: currentVerse.end_time
        }
      ],
      [{ text: "" }]
    ];

    stanza[itemIndex] = newColumnLayout;
    updateLyrics(currentLyrics);

    nextTick(() => {
      focusInput({ stanzaIndex, itemIndex, columnIndex: 0, lineIndex: 0 });
    });
  };

  // Insert new column
  const insertColumn = (before: boolean = false) => {
    if (!currentFocus.value) return;

    const { stanzaIndex, itemIndex, columnIndex } = currentFocus.value;

    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    // If not in column context, convert to columns first
    if (columnIndex === undefined) {
      convertToColumns();
      return;
    }

    const item = stanza[itemIndex] as LyricVerse[][];
    const newColumn: LyricVerse[] = [{ text: "" }];
    const insertIndex = before ? columnIndex : columnIndex + 1;

    item.splice(insertIndex, 0, newColumn);
    updateLyrics(currentLyrics);

    nextTick(() => {
      focusInput({ stanzaIndex, itemIndex, columnIndex: insertIndex, lineIndex: 0 });
    });
  };

  // Insert new stanza
  const insertStanza = () => {
    if (!currentFocus.value) return;

    const { stanzaIndex } = currentFocus.value;
    const currentLyrics = [...lyrics.value];
    const newStanza: (LyricVerse | LyricVerse[][])[] = [{ text: "" }];

    currentLyrics.splice(stanzaIndex + 1, 0, newStanza);
    updateLyrics(currentLyrics);

    nextTick(() => {
      focusInput({ stanzaIndex: stanzaIndex + 1, itemIndex: 0 });
    });
  };

  // Insert new line outside column context (for Shift+Enter in columns)
  const insertLineOutsideColumn = (before: boolean = false) => {
    if (!currentFocus.value) return;

    const { stanzaIndex, itemIndex, columnIndex } = currentFocus.value;

    // Only works when in column context
    if (columnIndex === undefined) return;

    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    const colorsToInherit = getColorsForInheritance();
    const newVerse: LyricVerse = {
      text: "",
      ...(colorsToInherit.length > 0 ? { color_keys: colorsToInherit } : {})
    };
    const insertIndex = before ? itemIndex : itemIndex + 1;

    // Insert the new verse outside the column structure
    stanza.splice(insertIndex, 0, newVerse);
    updateLyrics(currentLyrics);

    nextTick(() => {
      focusInput({ stanzaIndex, itemIndex: insertIndex });
    });
  };

  // Duplicate current line
  const duplicateLine = () => {
    if (!currentFocus.value) return;

    const { stanzaIndex, itemIndex, columnIndex, lineIndex } = currentFocus.value;
    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];

    if (!stanza) return;

    if (columnIndex !== undefined && lineIndex !== undefined) {
      // Duplicating in a column
      const item = stanza[itemIndex] as LyricVerse[][];
      const column = item[columnIndex];
      if (!column || !column[lineIndex]) return;
      const lineToDuplicate = { ...column[lineIndex], text: column[lineIndex].text || "" };

      column.splice(lineIndex + 1, 0, lineToDuplicate);
      updateLyrics(currentLyrics);

      nextTick(() => {
        focusInput({ stanzaIndex, itemIndex, columnIndex, lineIndex: lineIndex + 1 });
      });
    } else {
      // Duplicating a regular verse
      const itemToDuplicate = { ...(stanza[itemIndex] as LyricVerse) };
      stanza.splice(itemIndex + 1, 0, itemToDuplicate);
      updateLyrics(currentLyrics);

      nextTick(() => {
        focusInput({ stanzaIndex, itemIndex: itemIndex + 1 });
      });
    }
  };

  // Smart backspace: delete empty verse
  const handleSmartBackspace = () => {
    if (!currentFocus.value) return false;

    const { stanzaIndex, itemIndex, columnIndex, lineIndex } = currentFocus.value;
    const currentLyrics = lyrics.value;
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return false;

    // Check if current verse/line is empty
    let isEmpty = false;
    if (columnIndex !== undefined && lineIndex !== undefined) {
      // In column context
      const item = stanza[itemIndex] as LyricVerse[][];
      const column = item[columnIndex];
      if (column && column[lineIndex]) {
        isEmpty = !column[lineIndex].text?.trim();
      }
    } else {
      // Regular verse
      const verse = stanza[itemIndex] as LyricVerse;
      isEmpty = !verse.text?.trim();
    }

    // If empty and cursor is at start of input, delete the verse/line
    if (isEmpty) {
      const inputElement = getInputElement(currentFocus.value);
      if (inputElement && inputElement.selectionStart === 0) {
        deleteLine();
        return true;
      }
    }

    return false;
  };

  // Keyboard event handler
  const handleKeydown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;

    // Only handle events from our input fields
    if (!target.hasAttribute("data-input")) return;

    const isMac = navigator.platform.toLowerCase().includes("mac");
    const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

    // Smart backspace for empty verses
    if (event.key === "Backspace" && !cmdOrCtrl) {
      if (handleSmartBackspace()) {
        event.preventDefault();
        return;
      }
    }

    // Help toggle
    if (event.key === "F1") {
      event.preventDefault();
      showHelp.value = !showHelp.value;
      return;
    }

    // Navigation
    if (event.key === "ArrowUp" && !cmdOrCtrl) {
      event.preventDefault();
      navigateVertical("up");
    } else if (event.key === "ArrowDown" && !cmdOrCtrl) {
      event.preventDefault();
      navigateVertical("down");
    } else if (event.key === "ArrowLeft") {
      // Only navigate horizontally if cursor is at the beginning of the input
      const inputElement = target as HTMLInputElement;
      if (
        inputElement.selectionStart === 0 &&
        inputElement.selectionEnd === inputElement.selectionStart
      ) {
        event.preventDefault();
        navigateHorizontal("left");
      }
    } else if (event.key === "ArrowRight") {
      // Only navigate horizontally if cursor is at the end of the input
      const inputElement = target as HTMLInputElement;
      if (
        inputElement.selectionStart === inputElement.value.length &&
        inputElement.selectionEnd === inputElement.selectionStart
      ) {
        event.preventDefault();
        navigateHorizontal("right");
      }
    }

    // Line operations
    else if (event.key === "Enter" && !cmdOrCtrl && !event.altKey && !event.shiftKey) {
      event.preventDefault();
      insertLineWithColorInheritance(false); // Insert line after
    } else if (event.key === "Enter" && event.altKey && !cmdOrCtrl && !event.shiftKey) {
      event.preventDefault();
      insertLineWithColorInheritance(true); // Insert line before
    } else if (event.key === "Enter" && event.shiftKey && !cmdOrCtrl && !event.altKey) {
      event.preventDefault();
      insertLineOutsideColumn(false); // Insert line after, outside column context
    } else if (event.key === "Enter" && event.shiftKey && event.altKey && !cmdOrCtrl) {
      event.preventDefault();
      insertLineOutsideColumn(true); // Insert line before, outside column context
    } else if (event.key === "Backspace" && cmdOrCtrl && !event.shiftKey) {
      event.preventDefault();
      deleteLine();
    } else if (event.key === "d" && cmdOrCtrl && !event.shiftKey) {
      event.preventDefault();
      duplicateLineWithColors();
    }

    // Column operations
    else if (event.key === "]" && cmdOrCtrl) {
      event.preventDefault();
      insertColumn(!event.shiftKey);
    } else if (event.key === "[" && cmdOrCtrl) {
      event.preventDefault();
      insertColumn(true);
    } else if (event.key === "\\" && cmdOrCtrl && !event.shiftKey) {
      event.preventDefault();
      convertToColumns();
    }

    // Stanza operations
    else if (event.key === "Enter" && cmdOrCtrl && !event.shiftKey) {
      event.preventDefault();
      insertStanza();
    }

    // Color operations
    else if (event.key === "k" && cmdOrCtrl && !event.shiftKey) {
      event.preventDefault();
      toggleCopyColorFromMode();
    }

    // Save operation
    else if (event.key === "s" && cmdOrCtrl && !event.shiftKey) {
      event.preventDefault();
      if (onSave) {
        onSave();
      }
    }
  };

  // Handle input focus
  const handleInputFocus = (position: FocusPosition) => {
    currentFocus.value = position;
  };

  // Color operations
  const getCurrentVerseColors = (): string[] => {
    if (!currentFocus.value) return [];

    const { stanzaIndex, itemIndex, columnIndex, lineIndex } = currentFocus.value;
    const currentLyrics = lyrics.value;
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return [];

    let verse: LyricVerse | undefined;
    if (columnIndex !== undefined && lineIndex !== undefined) {
      // In column context
      const item = stanza[itemIndex] as LyricVerse[][];
      const column = item[columnIndex];
      if (column && column[lineIndex]) {
        verse = column[lineIndex];
      }
    } else {
      // Regular verse
      verse = stanza[itemIndex] as LyricVerse;
    }

    return verse?.color_keys || [];
  };

  const setCurrentVerseColors = (colors: string[]) => {
    if (!currentFocus.value) return;

    const { stanzaIndex, itemIndex, columnIndex, lineIndex } = currentFocus.value;
    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    if (columnIndex !== undefined && lineIndex !== undefined) {
      // In column context
      const item = stanza[itemIndex] as LyricVerse[][];
      const column = item[columnIndex];
      if (column && column[lineIndex]) {
        if (colors.length === 0) {
          delete column[lineIndex].color_keys;
        } else {
          column[lineIndex].color_keys = colors;
        }
      }
    } else {
      // Regular verse
      const verse = stanza[itemIndex] as LyricVerse;
      if (colors.length === 0) {
        delete verse.color_keys;
      } else {
        verse.color_keys = colors;
      }
    }

    updateLyrics(currentLyrics);
  };

  // Copy color from mode
  const copyColorFromMode = ref(false);

  const toggleCopyColorFromMode = () => {
    copyColorFromMode.value = !copyColorFromMode.value;
  };

  const copyColorsFromVerse = (sourcePosition: FocusPosition) => {
    if (!currentFocus.value || !copyColorFromMode.value) return;

    // Store the original focus to restore later
    const originalFocus = { ...currentFocus.value };

    const { stanzaIndex, itemIndex, columnIndex, lineIndex } = sourcePosition;
    const currentLyrics = lyrics.value;
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    let sourceColors: string[] = [];
    if (columnIndex !== undefined && lineIndex !== undefined) {
      // Source is in column context
      const item = stanza[itemIndex] as LyricVerse[][];
      const column = item[columnIndex];
      if (column && column[lineIndex]) {
        sourceColors = column[lineIndex].color_keys || [];
      }
    } else {
      // Source is regular verse
      const verse = stanza[itemIndex] as LyricVerse;
      sourceColors = verse.color_keys || [];
    }

    // Apply the colors to the current verse
    setCurrentVerseColors([...sourceColors]);

    // Exit copy mode after copying
    copyColorFromMode.value = false;

    // Restore focus to the original verse
    nextTick(() => {
      focusInput(originalFocus);
    });
  };

  const getColorsForInheritance = (): string[] => {
    if (!currentFocus.value) return [];
    return getCurrentVerseColors();
  };

  // Update insertLine to inherit colors
  const originalInsertLine = insertLine;
  const insertLineWithColorInheritance = (before: boolean = false) => {
    const colorsToInherit = getColorsForInheritance();
    originalInsertLine(before);

    // Apply inherited colors to the newly created line
    if (colorsToInherit.length > 0) {
      nextTick(() => {
        setCurrentVerseColors(colorsToInherit);
      });
    }
  };

  // Update duplicateLine to preserve colors
  const originalDuplicateLine = duplicateLine;
  const duplicateLineWithColors = () => {
    originalDuplicateLine();
    // Colors are already preserved in the duplication logic
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
    // Expose individual functions for button usage
    insertLine: insertLineWithColorInheritance,
    deleteLine,
    duplicateLine: duplicateLineWithColors,
    insertColumn,
    insertStanza,
    convertToColumns,
    navigateVertical,
    navigateHorizontal,
    // Color operations
    getCurrentVerseColors,
    setCurrentVerseColors,
    copyColorFromMode: computed(() => copyColorFromMode.value),
    toggleCopyColorFromMode,
    copyColorsFromVerse
  };
}
