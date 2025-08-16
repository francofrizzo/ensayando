import type { CollectionWithRole, LyricVerse } from "@/data/types";

export type LyricVerseStatus = "active" | "past" | "future";

export function useLyricsColoring() {
  const getVerseStyles = (
    verse: LyricVerse,
    collection: CollectionWithRole | null,
    status?: LyricVerseStatus
  ) => {
    if (!collection) return {};

    const defaultColor = collection.main_color;
    let color: string | undefined;
    let gradientColors: string[] = [];

    // Handle past status with gray color
    if (status === "past") {
      color = `var(--color-zinc-400)`;
    } else {
      const { track_colors: trackColors } = collection;
      if (verse.color_keys && verse.color_keys.length > 1) {
        gradientColors = verse.color_keys.map((colorKey) => trackColors[colorKey] ?? defaultColor);
      } else if (verse.color_keys && verse.color_keys.length === 1) {
        color = trackColors[verse.color_keys[0]!];
      } else {
        color = defaultColor;
      }
    }

    color = color ?? gradientColors[0] ?? defaultColor;
    gradientColors = gradientColors.length > 0 ? gradientColors : [color, color];

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
