import type { LyricStanza, LyricVerse } from "@/data/types";
import {
  calculatePositionAfterDeletion,
  findNextValidPosition,
  type FocusPosition,
  getFirstPositionInItem,
  getItemAtPosition,
  getLastPositionInItem,
  isColumnContext
} from "@/utils/lyricsPositionUtils";
import { computed, nextTick, ref, type Ref } from "vue";

export function useLyricsNavigation(lyrics: Ref<LyricStanza[]>) {
  const currentFocus = ref<FocusPosition | null>(null);

  const getCurrentVerse = (position: FocusPosition): LyricVerse | null => {
    if (isColumnContext(position)) {
      const item = getItemAtPosition(position, lyrics.value);
      if (Array.isArray(item)) {
        return item[position.columnIndex]?.[position.lineIndex] || null;
      }
    } else {
      const verse = getItemAtPosition(position, lyrics.value);
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
    let selector = `[data-lyrics-input="${stanzaIndex}-${itemIndex}`;

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

  const findNavigationPosition = (
    current: FocusPosition,
    direction: "up" | "down" | "left" | "right",
    lyricsState: LyricStanza[] = lyrics.value
  ): FocusPosition | null => {
    return findNextValidPosition(current, direction, lyricsState);
  };

  const findNextPosition = (
    current: FocusPosition,
    direction: "up" | "down" | "left" | "right"
  ): FocusPosition | null => {
    return findNavigationPosition(current, direction);
  };

  const findPositionAfterDeletion = (originalPosition: FocusPosition): FocusPosition | null => {
    return calculatePositionAfterDeletion(originalPosition, lyrics.value);
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
    getItemAtPosition: (position: FocusPosition, lyricsState?: LyricStanza[]) =>
      getItemAtPosition(position, lyricsState || lyrics.value),
    getLastPositionInItem,
    getFirstPositionInItem,
    findPositionAfterDeletion,
    navigateHorizontal,
    navigateVertical,
    handleInputFocus
  };
}
