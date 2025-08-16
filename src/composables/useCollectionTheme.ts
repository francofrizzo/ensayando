import { computed, type ComputedRef, type Ref } from "vue";

import type { CollectionWithRole } from "@/data/types";
import { selectMostContrasting } from "@/utils/color-utils";

export function useCollectionTheme(
  collection: ComputedRef<CollectionWithRole | null> | Ref<CollectionWithRole | null>
) {
  const themeVariables = computed(() => {
    if (!collection.value) return {};

    try {
      const primaryColor = collection.value.main_color;
      const primaryColorContentValue = selectMostContrasting(primaryColor, ["white", "black"]);
      return {
        "--color-primary": primaryColor,
        "--color-primary-content": primaryColorContentValue
      };
    } catch {
      return {};
    }
  });

  return {
    themeVariables
  };
}
