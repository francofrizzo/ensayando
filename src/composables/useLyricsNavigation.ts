import type { LyricStanza, LyricVerse } from "@/data/types";
import { computed, nextTick, ref, type Ref } from "vue";

export type FocusPosition = {
  stanzaIndex: number;
  itemIndex: number;
  columnIndex?: number;
  lineIndex?: number;
}

export function useLyricsNavigation(lyrics: Ref<LyricStanza[]>) {
  const currentFocus = ref<FocusPosition | null>(null);

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

  const findNavigationPosition = (
    current: FocusPosition,
    direction: "up" | "down" | "left" | "right",
    lyricsState: LyricStanza[] = lyrics.value
  ): FocusPosition | null => {
    const { stanzaIndex, itemIndex } = current;

    // Horizontal navigation
    if (direction === "left" || direction === "right") {
      if (!isColumnContext(current)) return null;

      const stanza = lyricsState[stanzaIndex];
      if (!stanza) return null;

      const item = stanza[itemIndex] as LyricVerse[][];
      if (!Array.isArray(item)) return null;

      if (direction === "right") {
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

      const stanza = lyricsState[stanzaIndex];
      if (stanza && itemIndex + 1 < stanza.length) {
        const nextItem = stanza[itemIndex + 1];
        const position = getFirstPositionInItem(nextItem, stanzaIndex, itemIndex + 1);
        if (position) return position;
      }

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
      if (isColumnContext(current) && current.lineIndex > 0) {
        return {
          stanzaIndex,
          itemIndex,
          columnIndex: current.columnIndex,
          lineIndex: current.lineIndex - 1
        };
      }

      if (itemIndex > 0) {
        const stanza = lyricsState[stanzaIndex];
        if (!stanza) return null;
        const prevItem = stanza[itemIndex - 1];
        const position = getLastPositionInItem(prevItem, stanzaIndex, itemIndex - 1);
        if (position) return position;
      }

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

  const findNextPosition = (
    current: FocusPosition,
    direction: "up" | "down" | "left" | "right"
  ): FocusPosition | null => {
    return findNavigationPosition(current, direction);
  };

  const findPositionAfterDeletion = (originalPosition: FocusPosition): FocusPosition | null => {
    const { stanzaIndex, itemIndex } = originalPosition;

    if (isColumnContext(originalPosition)) {
      const { columnIndex, lineIndex } = originalPosition;
      const currentStanza = lyrics.value[stanzaIndex];
      const item = currentStanza?.[itemIndex];

      if (Array.isArray(item)) {
        const column = item[columnIndex];
        if (column && column.length > 0) {
          if (lineIndex > 0 && column[lineIndex - 1]) {
            return { stanzaIndex, itemIndex, columnIndex, lineIndex: lineIndex - 1 };
          } else if (column[lineIndex]) {
            return { stanzaIndex, itemIndex, columnIndex, lineIndex };
          } else if (column[0]) {
            return { stanzaIndex, itemIndex, columnIndex, lineIndex: 0 };
          }
        }

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
          return { stanzaIndex, itemIndex, columnIndex, lineIndex: 0 };
        } else if (item[0]) {
          return { stanzaIndex, itemIndex, columnIndex: 0, lineIndex: 0 };
        }
      } else if (item) {
        return { stanzaIndex, itemIndex };
      }
    }

    const currentStanza = lyrics.value[stanzaIndex];

    if (!currentStanza || currentStanza.length === 0) {
      if (stanzaIndex > 0) {
        const prevStanza = lyrics.value[stanzaIndex - 1];
        if (prevStanza && prevStanza.length > 0) {
          const lastItemIndex = prevStanza.length - 1;
          const lastItem = prevStanza[lastItemIndex];
          return getLastPositionInItem(lastItem, stanzaIndex - 1, lastItemIndex);
        }
      } else if (lyrics.value[stanzaIndex]) {
        const nextStanza = lyrics.value[stanzaIndex];
        if (nextStanza.length > 0) {
          const firstItem = nextStanza[0];
          return getFirstPositionInItem(firstItem, stanzaIndex, 0);
        }
      }
      return null;
    }

    if (itemIndex > 0 && currentStanza[itemIndex - 1]) {
      const prevItem = currentStanza[itemIndex - 1];
      return getLastPositionInItem(prevItem, stanzaIndex, itemIndex - 1);
    } else if (itemIndex < currentStanza.length) {
      const targetItem = currentStanza[itemIndex];
      return getFirstPositionInItem(targetItem, stanzaIndex, itemIndex);
    } else if (currentStanza[0]) {
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

  const handleInputFocus = (position: FocusPosition) => {
    currentFocus.value = position;
  };

  return {
    currentFocus: computed(() => currentFocus.value),
    getCurrentVerse,
    getVerseText,
    focusInput,
    isColumnContext,
    getItemAtPosition,
    getLastPositionInItem,
    getFirstPositionInItem,
    findPositionAfterDeletion,
    navigateHorizontal,
    navigateVertical,
    handleInputFocus
  };
}
