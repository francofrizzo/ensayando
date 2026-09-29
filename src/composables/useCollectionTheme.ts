import { computed, type ComputedRef, onUnmounted, type Ref, watch } from "vue";

import type { CollectionWithRole } from "@/data/types";
import { collectionThemeVars, resolveCollectionPalette } from "@/utils/palette";

const THEME_VARS = [
  "--collection-hue",
  "--collection-fill",
  "--collection-ink-light",
  "--collection-ink-dark",
  "--collection-soft-light",
  "--collection-soft-dark"
] as const;

/**
 * Tints the whole app with the collection's color. DaisyUI's theme variables live
 * on :root, so the hue has to be set on <html> for them to pick it up (a wrapper
 * element would not recompute them). Without a collection, styles.css falls back
 * to the brand hue.
 *
 * Several screens use this, and on navigation the screen that's leaving can
 * unmount after the new one has already painted its collection. Only the latest
 * caller owns the variables, so a leaving screen never wipes the new colors.
 */
let owner = 0;
export function useCollectionTheme(
  collection: ComputedRef<CollectionWithRole | null> | Ref<CollectionWithRole | null>
) {
  const themeVariables = computed(() =>
    collection.value ? collectionThemeVars(resolveCollectionPalette(collection.value).main) : null
  );

  const root = typeof document !== "undefined" ? document.documentElement : null;
  const id = ++owner;

  const clear = () => {
    if (owner !== id) return;
    THEME_VARS.forEach((name) => root?.style.removeProperty(name));
  };

  watch(
    themeVariables,
    (vars) => {
      if (!root) return;
      owner = id;
      if (!vars) return clear();
      for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
    },
    { immediate: true }
  );

  onUnmounted(clear);
}
