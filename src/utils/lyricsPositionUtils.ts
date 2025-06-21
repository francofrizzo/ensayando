import type { LyricStanza, LyricVerse } from "@/data/types";

export type FocusPosition = {
  stanzaIndex: number;
  itemIndex: number;
  columnIndex?: number;
  lineIndex?: number;
};

export type BasePosition = {
  stanzaIndex: number;
  itemIndex: number;
};

export type RegularPosition = {} & BasePosition;

export type ColumnPosition = {
  columnIndex: number;
  lineIndex: number;
} & BasePosition;

export type LyricsPosition = RegularPosition | ColumnPosition;

// Type guards
export const isColumnContext = (
  position: FocusPosition
): position is FocusPosition & { columnIndex: number; lineIndex: number } => {
  return position.columnIndex !== undefined && position.lineIndex !== undefined;
};

export function isColumnPosition(pos: LyricsPosition): pos is ColumnPosition {
  return "columnIndex" in pos && "lineIndex" in pos;
}

// Position validation
export const validatePosition = (position: FocusPosition, lyrics: LyricStanza[]): boolean => {
  const { stanzaIndex, itemIndex } = position;

  // Check if stanza exists
  if (stanzaIndex < 0 || stanzaIndex >= lyrics.length) {
    return false;
  }

  const stanza = lyrics[stanzaIndex];
  if (!stanza || itemIndex < 0 || itemIndex >= stanza.length) {
    return false;
  }

  // If it's a column context, validate column and line indices
  if (isColumnContext(position)) {
    const { columnIndex, lineIndex } = position;
    const item = stanza[itemIndex];

    if (!Array.isArray(item)) {
      return false;
    }

    const columns = item as LyricVerse[][];
    if (columnIndex < 0 || columnIndex >= columns.length) {
      return false;
    }

    const column = columns[columnIndex];
    if (!column || lineIndex < 0 || lineIndex >= column.length) {
      return false;
    }
  }

  return true;
};

// Item retrieval
export const getItemAtPosition = (
  position: FocusPosition,
  lyrics: LyricStanza[]
): LyricVerse | LyricVerse[][] | null => {
  const stanza = lyrics[position.stanzaIndex];
  return stanza?.[position.itemIndex] || null;
};

// Position calculation helpers
export const getLastPositionInItem = (
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

export const getFirstPositionInItem = (
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

// Navigation position finding
export const findNextValidPosition = (
  current: FocusPosition,
  direction: "up" | "down" | "left" | "right",
  lyrics: LyricStanza[]
): FocusPosition | null => {
  const { stanzaIndex, itemIndex } = current;

  // Horizontal navigation
  if (direction === "left" || direction === "right") {
    if (!isColumnContext(current)) return null;

    const stanza = lyrics[stanzaIndex];
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
      const item = lyrics[stanzaIndex]?.[itemIndex];
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

    const stanza = lyrics[stanzaIndex];
    if (stanza && itemIndex + 1 < stanza.length) {
      const nextItem = stanza[itemIndex + 1];
      const position = getFirstPositionInItem(nextItem, stanzaIndex, itemIndex + 1);
      if (position) return position;
    }

    if (stanzaIndex + 1 < lyrics.length) {
      const nextStanza = lyrics[stanzaIndex + 1];
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
      const stanza = lyrics[stanzaIndex];
      if (!stanza) return null;
      const prevItem = stanza[itemIndex - 1];
      const position = getLastPositionInItem(prevItem, stanzaIndex, itemIndex - 1);
      if (position) return position;
    }

    if (stanzaIndex > 0) {
      const prevStanza = lyrics[stanzaIndex - 1];
      if (prevStanza && prevStanza.length > 0) {
        const lastItem = prevStanza[prevStanza.length - 1];
        const position = getLastPositionInItem(lastItem, stanzaIndex - 1, prevStanza.length - 1);
        if (position) return position;
      }
    }
  }

  return null;
};

// Position adjustment after deletion
export const calculatePositionAfterDeletion = (
  originalPosition: FocusPosition,
  lyrics: LyricStanza[]
): FocusPosition | null => {
  const { stanzaIndex, itemIndex } = originalPosition;

  if (isColumnContext(originalPosition)) {
    const { columnIndex, lineIndex } = originalPosition;
    const currentStanza = lyrics[stanzaIndex];
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

  const currentStanza = lyrics[stanzaIndex];

  if (!currentStanza || currentStanza.length === 0) {
    if (stanzaIndex > 0) {
      const prevStanza = lyrics[stanzaIndex - 1];
      if (prevStanza && prevStanza.length > 0) {
        const lastItemIndex = prevStanza.length - 1;
        const lastItem = prevStanza[lastItemIndex];
        return getLastPositionInItem(lastItem, stanzaIndex - 1, lastItemIndex);
      }
    } else if (lyrics[stanzaIndex]) {
      const nextStanza = lyrics[stanzaIndex];
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

// Composable for position management
export const useLyricsPositionUtils = () => {
  return {
    isColumnContext,
    isColumnPosition,
    validatePosition,
    getItemAtPosition,
    getFirstPositionInItem,
    getLastPositionInItem,
    findNextValidPosition,
    calculatePositionAfterDeletion
  };
};
