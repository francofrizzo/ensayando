import type { LyricStanza, LyricVerse } from "@/data/types";
import {
  type FocusPosition,
  getItemAtPosition,
  isColumnContext
} from "@/utils/lyricsPositionUtils";
import { type Ref } from "vue";

export function useLyricsOperations(
  lyrics: Ref<LyricStanza[]>,
  updateLyrics: (newLyrics: LyricStanza[]) => void,
  focusInput: (position: FocusPosition) => Promise<void>,
  findPositionAfterDeletion: (originalPosition: FocusPosition) => FocusPosition | null
) {
  const createEmptyVerse = (): LyricVerse => ({
    text: "",
    start_time: undefined,
    end_time: undefined
  });

  const createVerseWithInheritance = (sourceVerse: LyricVerse): LyricVerse => ({
    text: "",
    start_time: undefined,
    end_time: undefined,
    color_keys: sourceVerse.color_keys ? [...sourceVerse.color_keys] : undefined,
    audio_track_ids: sourceVerse.audio_track_ids ? [...sourceVerse.audio_track_ids] : undefined,
    comment: undefined
  });

  const insertLine = (currentFocus: FocusPosition, before: boolean = false) => {
    const { stanzaIndex, itemIndex } = currentFocus;
    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    if (isColumnContext(currentFocus)) {
      const { columnIndex, lineIndex } = currentFocus;
      const item = getItemAtPosition(currentFocus, currentLyrics);

      if (Array.isArray(item) && item[columnIndex]) {
        const targetColumn = item[columnIndex];
        if (targetColumn) {
          const newVerse = createEmptyVerse();

          if (before) {
            targetColumn.splice(lineIndex, 0, newVerse);
            updateLyrics(currentLyrics);
            focusInput({ stanzaIndex, itemIndex, columnIndex, lineIndex });
          } else {
            targetColumn.splice(lineIndex + 1, 0, newVerse);
            updateLyrics(currentLyrics);
            focusInput({ stanzaIndex, itemIndex, columnIndex, lineIndex: lineIndex + 1 });
          }
        }
      }
    } else {
      const newVerse = createEmptyVerse();

      if (before) {
        stanza.splice(itemIndex, 0, newVerse);
        updateLyrics(currentLyrics);
        focusInput({ stanzaIndex, itemIndex });
      } else {
        stanza.splice(itemIndex + 1, 0, newVerse);
        updateLyrics(currentLyrics);
        focusInput({ stanzaIndex, itemIndex: itemIndex + 1 });
      }
    }
  };

  const deleteLine = (currentFocus: FocusPosition) => {
    const { stanzaIndex, itemIndex } = currentFocus;
    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    if (isColumnContext(currentFocus)) {
      const { columnIndex, lineIndex } = currentFocus;
      const item = getItemAtPosition(currentFocus, currentLyrics);
      if (Array.isArray(item) && item[columnIndex]) {
        const targetColumn = item[columnIndex];
        if (targetColumn) {
          targetColumn.splice(lineIndex, 1);

          if (targetColumn.length === 0) {
            item.splice(columnIndex, 1);

            if (item.length === 0) {
              stanza.splice(itemIndex, 1);
            } else if (item.length === 1) {
              const remainingColumn = item[0];
              if (remainingColumn && remainingColumn.length === 1) {
                const singleVerse = remainingColumn[0];
                if (singleVerse) {
                  stanza[itemIndex] = singleVerse;
                }
              }
            }
          }
        }
      }
    } else {
      stanza.splice(itemIndex, 1);

      if (stanza.length === 0) {
        currentLyrics.splice(stanzaIndex, 1);
      }
    }

    updateLyrics(currentLyrics);

    const nextPosition = findPositionAfterDeletion(currentFocus);
    if (nextPosition) {
      focusInput(nextPosition);
    }
  };

  const convertToColumns = (currentFocus: FocusPosition) => {
    const { stanzaIndex, itemIndex } = currentFocus;
    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    const currentItem = stanza[itemIndex];

    if (Array.isArray(currentItem)) return;

    const verse = currentItem as LyricVerse;
    const newColumns: LyricVerse[][] = [[{ ...verse }], [createVerseWithInheritance(verse)]];

    stanza[itemIndex] = newColumns;
    updateLyrics(currentLyrics);

    focusInput({ stanzaIndex, itemIndex, columnIndex: 1, lineIndex: 0 });
  };

  const insertColumn = (currentFocus: FocusPosition, before: boolean = false) => {
    const { stanzaIndex, itemIndex } = currentFocus;

    if (!isColumnContext(currentFocus)) return;

    const { columnIndex, lineIndex } = currentFocus;
    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    const item = stanza[itemIndex] as LyricVerse[][];
    if (!Array.isArray(item)) return;

    // Get the current verse to inherit properties from
    const currentVerse = item[columnIndex] && item[columnIndex][lineIndex];
    if (!currentVerse) return;

    const newColumn: LyricVerse[] = [createVerseWithInheritance(currentVerse)];

    if (before) {
      item.splice(columnIndex, 0, newColumn);
      updateLyrics(currentLyrics);
      focusInput({
        stanzaIndex,
        itemIndex,
        columnIndex,
        lineIndex: 0
      });
    } else {
      item.splice(columnIndex + 1, 0, newColumn);
      updateLyrics(currentLyrics);
      focusInput({
        stanzaIndex,
        itemIndex,
        columnIndex: columnIndex + 1,
        lineIndex: 0
      });
    }
  };

  const insertStanza = (currentFocus: FocusPosition) => {
    const { stanzaIndex } = currentFocus;
    const currentLyrics = [...lyrics.value];

    const newStanza: LyricStanza = [createEmptyVerse()];

    currentLyrics.splice(stanzaIndex + 1, 0, newStanza);
    updateLyrics(currentLyrics);

    focusInput({ stanzaIndex: stanzaIndex + 1, itemIndex: 0 });
  };

  const insertLineOutsideColumn = (currentFocus: FocusPosition, before: boolean = false) => {
    const { stanzaIndex, itemIndex } = currentFocus;
    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    const newVerse = createEmptyVerse();

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

  const duplicateLine = (currentFocus: FocusPosition) => {
    const { stanzaIndex, itemIndex } = currentFocus;
    const currentLyrics = [...lyrics.value];
    const stanza = currentLyrics[stanzaIndex];
    if (!stanza) return;

    if (isColumnContext(currentFocus)) {
      const { columnIndex, lineIndex } = currentFocus;
      const item = getItemAtPosition(currentFocus, currentLyrics);
      if (Array.isArray(item) && item[columnIndex] && item[columnIndex]![lineIndex]) {
        const originalVerse = item[columnIndex]![lineIndex];
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
          const targetColumn = item[columnIndex];
          if (targetColumn) {
            targetColumn.splice(lineIndex + 1, 0, duplicatedVerse);
          }
          updateLyrics(currentLyrics);
          focusInput({
            stanzaIndex,
            itemIndex,
            columnIndex,
            lineIndex: lineIndex + 1
          });
        }
      }
    } else {
      const originalVerse = stanza[itemIndex] as LyricVerse;
      if (originalVerse) {
        const duplicatedVerse = { ...originalVerse };
        stanza.splice(itemIndex + 1, 0, duplicatedVerse);
        updateLyrics(currentLyrics);
        focusInput({ stanzaIndex, itemIndex: itemIndex + 1 });
      }
    }
  };

  return {
    insertLine,
    deleteLine,
    convertToColumns,
    insertColumn,
    insertStanza,
    insertLineOutsideColumn,
    duplicateLine
  };
}
