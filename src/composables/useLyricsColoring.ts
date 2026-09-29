import { useTheme } from "@/composables/useTheme";
import type { CollectionWithRole, LyricVerse } from "@/data/types";
import { deriveColor, resolveCollectionPalette } from "@/utils/palette";

export type LyricVerseStatus = "active" | "past" | "future";

// Sung verses: the text color at 30 %, so they recede in any theme or collection.
const PAST_COLOR = "color-mix(in oklch, var(--color-base-content) 30%, transparent)";

export function useLyricsColoring() {
  const { resolvedTheme } = useTheme();

  const getVerseStyles = (
    verse: LyricVerse,
    collection: CollectionWithRole | null,
    status?: LyricVerseStatus
  ) => {
    if (!collection) return {};

    const palette = resolveCollectionPalette(collection);
    const ink = (colorKey?: string) =>
      deriveColor(
        (colorKey ? palette.tracks[colorKey] : undefined) ?? palette.main,
        "lyric",
        resolvedTheme.value
      );

    let colors: string[];
    if (status === "past") {
      colors = [PAST_COLOR];
    } else if (verse.color_keys && verse.color_keys.length > 0) {
      colors = verse.color_keys.map((colorKey) => ink(colorKey));
    } else {
      colors = [ink()];
    }

    const color = colors[0]!;
    const gradientColors = colors.length > 1 ? colors : [color, color];

    return {
      color,
      "background-image": `linear-gradient(to right, ${gradientColors.join(", ")})`,
      "-webkit-background-clip": "text",
      "-webkit-text-fill-color": "transparent",
      "background-clip": "text"
    };
  };

  return {
    getVerseStyles
  };
}
