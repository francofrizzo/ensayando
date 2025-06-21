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

  const getInputElement = (position: FocusPosition): HTMLInputElement | null => {
    const { stanzaIndex, itemIndex, columnIndex, lineIndex } = position;
    let selector = `[data-input="${stanzaIndex}-${itemIndex}`;

    if (columnIndex !== undefined && lineIndex !== undefined) {
      selector += `-${columnIndex}-${lineIndex}`;
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

  const navigateHorizontal = (direction: "left" | "right") => {
    if (!currentFocus.value) return;

    const { stanzaIndex, itemIndex, columnIndex, lineIndex } = currentFocus.value;

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
        if (prevStanza && prevStanza.length > 0) {
          const lastItem = prevStanza[prevStanza.length - 1];
          if (Array.isArray(lastItem)) {
            const columns = lastItem as LyricVerse[][];
            const lastColumn = columns.length - 1;
            const lastLine = columns[lastColumn] ? columns[lastColumn].length - 1 : 0;
            focusInput({
              stanzaIndex: stanzaIndex - 1,
              itemIndex: prevStanza.length - 1,
              columnIndex: lastColumn,
              lineIndex: lastLine
            });
          } else {
            focusInput({ stanzaIndex: stanzaIndex - 1, itemIndex: prevStanza.length - 1 });
          }
        }
      }
    }
  };

  const insertLine = (before: boolean = false) => {
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
      // Focus the newly inserted line
      focusInput({ stanzaIndex, itemIndex });
    } else {
      stanza.splice(itemIndex + 1, 0, newVerse);
      updateLyrics(currentLyrics);
      // Focus the newly inserted line
      focusInput({ stanzaIndex, itemIndex: itemIndex + 1 });
    }
  };

  const deleteLine = () => {
    if (!currentFocus.value) return;

    const { stanzaIndex, itemIndex, columnIndex, lineIndex } = currentFocus.value;
    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    if (columnIndex !== undefined && lineIndex !== undefined) {
      // Delete from column
      const item = stanza[itemIndex] as LyricVerse[][];
      if (Array.isArray(item) && item[columnIndex]) {
        item[columnIndex].splice(lineIndex, 1);

        // If column is empty, remove it
        if (item[columnIndex].length === 0) {
          item.splice(columnIndex, 1);

          // If all columns are empty, remove the entire item
          if (item.length === 0) {
            stanza.splice(itemIndex, 1);
            updateLyrics(currentLyrics);

            // Focus previous item if possible
            if (itemIndex > 0) {
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
            } else if (stanza.length > 0) {
              const nextItem = stanza[0];
              if (Array.isArray(nextItem)) {
                focusInput({ stanzaIndex, itemIndex: 0, columnIndex: 0, lineIndex: 0 });
              } else {
                focusInput({ stanzaIndex, itemIndex: 0 });
              }
            }
            return;
          } else {
            // Focus the next available column
            const targetColumn = Math.min(columnIndex, item.length - 1);
            const targetColumnArray = item[targetColumn];
            const targetLine = Math.min(
              lineIndex,
              targetColumnArray ? targetColumnArray.length - 1 : 0
            );
            focusInput({
              stanzaIndex,
              itemIndex,
              columnIndex: targetColumn,
              lineIndex: targetLine
            });
          }
        } else {
          // Focus the next available line in the same column
          const columnArray = item[columnIndex];
          const targetLine = Math.min(lineIndex, columnArray ? columnArray.length - 1 : 0);
          focusInput({
            stanzaIndex,
            itemIndex,
            columnIndex,
            lineIndex: targetLine
          });
        }
      }
    } else {
      // Delete regular verse
      stanza.splice(itemIndex, 1);

      // If stanza is empty after deletion, remove it
      if (stanza.length === 0) {
        currentLyrics.splice(stanzaIndex, 1);
        updateLyrics(currentLyrics);

        // Focus previous stanza if possible
        if (stanzaIndex > 0 && currentLyrics[stanzaIndex - 1]) {
          const prevStanza = currentLyrics[stanzaIndex - 1]!;
          if (prevStanza.length > 0) {
            const lastItem = prevStanza[prevStanza.length - 1];
            if (Array.isArray(lastItem)) {
              const columns = lastItem as LyricVerse[][];
              const lastColumn = columns.length - 1;
              const lastColumnArray = columns[lastColumn];
              const lastLine = lastColumnArray ? lastColumnArray.length - 1 : 0;
              focusInput({
                stanzaIndex: stanzaIndex - 1,
                itemIndex: prevStanza.length - 1,
                columnIndex: lastColumn,
                lineIndex: lastLine
              });
            } else {
              focusInput({ stanzaIndex: stanzaIndex - 1, itemIndex: prevStanza.length - 1 });
            }
          }
        } else if (currentLyrics.length > 0) {
          // Focus first stanza
          const firstStanza = currentLyrics[0];
          if (firstStanza && firstStanza.length > 0) {
            const firstItem = firstStanza[0];
            if (Array.isArray(firstItem)) {
              focusInput({ stanzaIndex: 0, itemIndex: 0, columnIndex: 0, lineIndex: 0 });
            } else {
              focusInput({ stanzaIndex: 0, itemIndex: 0 });
            }
          }
        }
        return;
      }

      // Focus the previous item first (better UX for smart backspace)
      if (itemIndex > 0) {
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
      } else if (itemIndex < stanza.length) {
        // Only go to next item if there's no previous item
        const nextItem = stanza[itemIndex];
        if (Array.isArray(nextItem)) {
          focusInput({ stanzaIndex, itemIndex, columnIndex: 0, lineIndex: 0 });
        } else {
          focusInput({ stanzaIndex, itemIndex });
        }
      }
    }

    updateLyrics(currentLyrics);
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
    const newColumns: LyricVerse[][] = [[{ ...verse }]];

    stanza[itemIndex] = newColumns;
    updateLyrics(currentLyrics);

    // Focus the converted item
    focusInput({ stanzaIndex, itemIndex, columnIndex: 0, lineIndex: 0 });
  };

  const insertColumn = (before: boolean = false) => {
    if (!currentFocus.value) return;

    const { stanzaIndex, itemIndex, columnIndex } = currentFocus.value;

    if (columnIndex === undefined) return;

    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    const item = stanza[itemIndex] as LyricVerse[][];
    if (!Array.isArray(item)) return;

    const newColumn: LyricVerse[] = [{ text: "", start_time: undefined, end_time: undefined }];

    if (before) {
      item.splice(columnIndex, 0, newColumn);
      updateLyrics(currentLyrics);
      focusInput({ stanzaIndex, itemIndex, columnIndex, lineIndex: 0 });
    } else {
      item.splice(columnIndex + 1, 0, newColumn);
      updateLyrics(currentLyrics);
      focusInput({ stanzaIndex, itemIndex, columnIndex: columnIndex + 1, lineIndex: 0 });
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

    const { stanzaIndex, itemIndex, columnIndex, lineIndex } = currentFocus.value;
    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    if (columnIndex !== undefined && lineIndex !== undefined) {
      // Duplicate in column context
      const item = stanza[itemIndex] as LyricVerse[][];
      if (Array.isArray(item) && item[columnIndex] && item[columnIndex][lineIndex]) {
        const originalVerse = item[columnIndex][lineIndex];
        const duplicatedVerse = { ...originalVerse };
        item[columnIndex].splice(lineIndex + 1, 0, duplicatedVerse);
        updateLyrics(currentLyrics);
        focusInput({ stanzaIndex, itemIndex, columnIndex, lineIndex: lineIndex + 1 });
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

    const { stanzaIndex, itemIndex, columnIndex, lineIndex } = currentFocus.value;
    const currentLyrics = lyrics.value;
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return false;

    let currentText = "";

    if (columnIndex !== undefined && lineIndex !== undefined) {
      // Check text in column context
      const item = stanza[itemIndex] as LyricVerse[][];
      if (Array.isArray(item) && item[columnIndex] && item[columnIndex][lineIndex]) {
        currentText = item[columnIndex][lineIndex].text;
      }
    } else {
      // Check text in regular verse
      const verse = stanza[itemIndex] as LyricVerse;
      currentText = verse.text;
    }

    // Only delete if the text is empty
    if (currentText === "") {
      deleteLine();
      return true;
    }

    return false;
  };

  const setCurrentVerseStartTime = () => {
    if (!currentFocus.value || !getCurrentTime) return;

    const { stanzaIndex, itemIndex, columnIndex, lineIndex } = currentFocus.value;
    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    const currentTime = getCurrentTime();

    if (columnIndex !== undefined && lineIndex !== undefined) {
      // Set in column context
      const item = stanza[itemIndex] as LyricVerse[][];
      if (Array.isArray(item) && item[columnIndex] && item[columnIndex][lineIndex]) {
        item[columnIndex][lineIndex].start_time = currentTime;
      }
    } else {
      // Set in regular verse
      const verse = stanza[itemIndex] as LyricVerse;
      verse.start_time = currentTime;
    }

    updateLyrics(currentLyrics);
  };

  const setCurrentVerseEndTime = () => {
    if (!currentFocus.value || !getCurrentTime) return;

    const { stanzaIndex, itemIndex, columnIndex, lineIndex } = currentFocus.value;
    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    const currentTime = getCurrentTime();

    if (columnIndex !== undefined && lineIndex !== undefined) {
      // Set in column context
      const item = stanza[itemIndex] as LyricVerse[][];
      if (Array.isArray(item) && item[columnIndex] && item[columnIndex][lineIndex]) {
        item[columnIndex][lineIndex].end_time = currentTime;
      }
    } else {
      // Set in regular verse
      const verse = stanza[itemIndex] as LyricVerse;
      verse.end_time = currentTime;
    }

    updateLyrics(currentLyrics);
  };

  const adjustCurrentVerseStartTime = (deltaSeconds: number) => {
    if (!currentFocus.value) return;

    const { stanzaIndex, itemIndex, columnIndex, lineIndex } = currentFocus.value;
    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    let verse: LyricVerse | undefined;
    if (columnIndex !== undefined && lineIndex !== undefined) {
      const item = stanza[itemIndex] as LyricVerse[][];
      if (Array.isArray(item) && item[columnIndex] && item[columnIndex][lineIndex]) {
        verse = item[columnIndex][lineIndex];
      }
    } else {
      verse = stanza[itemIndex] as LyricVerse;
    }

    if (verse && verse.start_time !== undefined) {
      verse.start_time = Math.max(0, verse.start_time + deltaSeconds);
      updateLyrics(currentLyrics);
    }
  };

  const adjustCurrentVerseEndTime = (deltaSeconds: number) => {
    if (!currentFocus.value) return;

    const { stanzaIndex, itemIndex, columnIndex, lineIndex } = currentFocus.value;
    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    let verse: LyricVerse | undefined;
    if (columnIndex !== undefined && lineIndex !== undefined) {
      const item = stanza[itemIndex] as LyricVerse[][];
      if (Array.isArray(item) && item[columnIndex] && item[columnIndex][lineIndex]) {
        verse = item[columnIndex][lineIndex];
      }
    } else {
      verse = stanza[itemIndex] as LyricVerse;
    }

    if (verse && verse.end_time !== undefined) {
      verse.end_time = Math.max(0, verse.end_time + deltaSeconds);
      updateLyrics(currentLyrics);
    }
  };

  const clearCurrentVerseStartTime = () => {
    if (!currentFocus.value) return;

    const { stanzaIndex, itemIndex, columnIndex, lineIndex } = currentFocus.value;
    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    if (columnIndex !== undefined && lineIndex !== undefined) {
      const item = stanza[itemIndex] as LyricVerse[][];
      if (Array.isArray(item) && item[columnIndex] && item[columnIndex][lineIndex]) {
        item[columnIndex][lineIndex].start_time = undefined;
      }
    } else {
      const verse = stanza[itemIndex] as LyricVerse;
      verse.start_time = undefined;
    }

    updateLyrics(currentLyrics);
  };

  const clearCurrentVerseEndTime = () => {
    if (!currentFocus.value) return;

    const { stanzaIndex, itemIndex, columnIndex, lineIndex } = currentFocus.value;
    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    if (columnIndex !== undefined && lineIndex !== undefined) {
      const item = stanza[itemIndex] as LyricVerse[][];
      if (Array.isArray(item) && item[columnIndex] && item[columnIndex][lineIndex]) {
        item[columnIndex][lineIndex].end_time = undefined;
      }
    } else {
      const verse = stanza[itemIndex] as LyricVerse;
      verse.end_time = undefined;
    }

    updateLyrics(currentLyrics);
  };

  const clearCurrentVerseBothTimes = () => {
    if (!currentFocus.value) return;

    const { stanzaIndex, itemIndex, columnIndex, lineIndex } = currentFocus.value;
    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    if (columnIndex !== undefined && lineIndex !== undefined) {
      const item = stanza[itemIndex] as LyricVerse[][];
      if (Array.isArray(item) && item[columnIndex] && item[columnIndex][lineIndex]) {
        item[columnIndex][lineIndex].start_time = undefined;
        item[columnIndex][lineIndex].end_time = undefined;
      }
    } else {
      const verse = stanza[itemIndex] as LyricVerse;
      verse.start_time = undefined;
      verse.end_time = undefined;
    }

    updateLyrics(currentLyrics);
  };

  const getColorsForInheritance = (): string[] => {
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

  const getAudioTrackIdsForInheritance = (): number[] => {
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

    return verse?.audio_track_ids || [];
  };

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

  const getCurrentVerseAudioTrackIds = (): number[] => {
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

    return verse?.audio_track_ids || [];
  };

  const setCurrentVerseAudioTrackIds = (trackIds: number[]) => {
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
        if (trackIds.length === 0) {
          delete column[lineIndex].audio_track_ids;
        } else {
          column[lineIndex].audio_track_ids = trackIds;
        }
      }
    } else {
      // Regular verse
      const verse = stanza[itemIndex] as LyricVerse;
      if (trackIds.length === 0) {
        delete verse.audio_track_ids;
      } else {
        verse.audio_track_ids = trackIds;
      }
    }

    updateLyrics(currentLyrics);
  };

  const copyPropertiesFromMode = ref(false);

  const toggleCopyPropertiesFromMode = () => {
    copyPropertiesFromMode.value = !copyPropertiesFromMode.value;
  };

  const copyPropertiesFromVerse = (sourcePosition: FocusPosition) => {
    if (!currentFocus.value || !copyPropertiesFromMode.value) return;

    // Store the original focus to restore later
    const originalFocus = { ...currentFocus.value };

    const { stanzaIndex, itemIndex, columnIndex, lineIndex } = sourcePosition;
    const currentLyrics = lyrics.value;
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    let sourceColors: string[] = [];
    let sourceTrackIds: number[] = [];

    if (columnIndex !== undefined && lineIndex !== undefined) {
      // Source is in column context
      const item = stanza[itemIndex] as LyricVerse[][];
      const column = item[columnIndex];
      if (column && column[lineIndex]) {
        sourceColors = column[lineIndex].color_keys || [];
        sourceTrackIds = column[lineIndex].audio_track_ids || [];
      }
    } else {
      // Source is regular verse
      const verse = stanza[itemIndex] as LyricVerse;
      sourceColors = verse.color_keys || [];
      sourceTrackIds = verse.audio_track_ids || [];
    }

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
  const hasColumnContext = computed(() => currentFocus.value?.columnIndex !== undefined);

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
        if (handled) {
          return true;
        }
        return false;
      },
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "Backspace",
        preventDefault: false
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
        key: "\\",
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
