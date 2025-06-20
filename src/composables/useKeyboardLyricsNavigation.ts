import type { LyricStanza, LyricVerse } from "@/data/types";
import { computed, nextTick, onMounted, onUnmounted, ref, type Ref } from "vue";

export interface FocusPosition {
  stanzaIndex: number;
  itemIndex: number;
  columnIndex?: number;
  lineIndex?: number;
}

export function useKeyboardLyricsNavigation(
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
        // Don't delete the last line in a column
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
        // Don't delete the last item in a stanza
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

  // Insert new column
  const insertColumn = (before: boolean = false) => {
    if (!currentFocus.value) return;

    const { stanzaIndex, itemIndex, columnIndex } = currentFocus.value;
    if (columnIndex === undefined) return;

    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;
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

  // Keyboard event handler
  const handleKeydown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;

    // Only handle events from our input fields
    if (!target.hasAttribute("data-input")) return;

    const isMac = navigator.platform.toLowerCase().includes("mac");
    const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

    // Help toggle
    if (event.key === "?" && event.shiftKey) {
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
    }

    // Line operations
    else if (event.key === "Enter" && cmdOrCtrl) {
      event.preventDefault();
      insertLine(event.shiftKey);
    } else if (event.key === "Backspace" && cmdOrCtrl && !event.shiftKey) {
      event.preventDefault();
      deleteLine();
    } else if (event.key === "d" && cmdOrCtrl && !event.shiftKey) {
      event.preventDefault();
      duplicateLine();
    }

    // Column operations (only in multi-column contexts)
    else if (event.key === "]" && cmdOrCtrl && currentFocus.value?.columnIndex !== undefined) {
      event.preventDefault();
      insertColumn(!event.shiftKey);
    } else if (event.key === "[" && cmdOrCtrl && currentFocus.value?.columnIndex !== undefined) {
      event.preventDefault();
      insertColumn(true);
    }

    // Stanza operations
    else if (event.key === "n" && cmdOrCtrl && event.shiftKey) {
      event.preventDefault();
      insertStanza();
    }
  };

  // Handle input focus
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
    focusInput
  };
}
