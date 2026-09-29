import { computed, type ComputedRef, type Ref } from "vue";

import { useTheme } from "@/composables/useTheme";
import type { Collection } from "@/data/types";
import {
  type ColorRole,
  type ColorSpec,
  deriveColor,
  resolveCollectionPalette
} from "@/utils/palette";

type MaybeCollection = ComputedRef<Collection | null | undefined> | Ref<Collection | null | undefined>;

/**
 * Theme-aware colors for a collection. Everything that paints a collection or
 * track color goes through here, so the raw stored values are never used directly.
 */
export function useCollectionPalette(collection: MaybeCollection) {
  const { resolvedTheme } = useTheme();
  const palette = computed(() => resolveCollectionPalette(collection.value));

  const trackSpec = (colorKey: string | undefined | null): ColorSpec =>
    (colorKey ? palette.value.tracks[colorKey] : undefined) ?? palette.value.main;

  const trackColor = (colorKey: string | undefined | null, role: ColorRole, alpha?: number) =>
    deriveColor(trackSpec(colorKey), role, resolvedTheme.value, alpha);

  const mainColor = (role: ColorRole, alpha?: number) =>
    deriveColor(palette.value.main, role, resolvedTheme.value, alpha);

  /** Options for color pickers: key plus the swatch (fill) color, which always takes white text. */
  const colorOptions = computed(() =>
    Object.keys(palette.value.tracks).map((key) => ({
      key,
      value: deriveColor(palette.value.tracks[key]!, "fill", resolvedTheme.value)
    }))
  );

  return { palette, resolvedTheme, trackSpec, trackColor, mainColor, colorOptions };
}
