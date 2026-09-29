import { computed, type ComputedRef, onUnmounted, type Ref, watch } from "vue";

import type { CollectionWithRole } from "@/data/types";
import { collectionThemeVars, resolveCollectionPalette } from "@/utils/palette";

const THEME_VARS = ["--collection-hue", "--collection-chroma"] as const;

/**
 * Tints the whole app with the collection's hue. DaisyUI's theme variables live
 * on :root, so the hue has to be set on <html> for them to pick it up (a wrapper
 * element would not recompute them). Without a collection, styles.css falls back
 * to the brand hue.
 */
export function useCollectionTheme(
  collection: ComputedRef<CollectionWithRole | null> | Ref<CollectionWithRole | null>
) {
  const themeVariables = computed(() =>
    collection.value ? collectionThemeVars(resolveCollectionPalette(collection.value).main) : null
  );

  const root = typeof document !== "undefined" ? document.documentElement : null;

  const clear = () => THEME_VARS.forEach((name) => root?.style.removeProperty(name));

  watch(
    themeVariables,
    (vars) => {
      if (!root) return;
      if (!vars) return clear();
      for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
    },
    { immediate: true }
  );

  onUnmounted(clear);
}
