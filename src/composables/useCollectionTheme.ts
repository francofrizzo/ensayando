import { computed, type ComputedRef, type Ref } from "vue";

import type { Collection } from "@/data/types";
import { selectMostContrasting } from "@/utils/utils";

export function useCollectionTheme(
  collection: ComputedRef<Collection | null> | Ref<Collection | null>
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
