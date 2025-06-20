import { computed } from "vue";

import { useRouteParams } from "@/composables/useRouteParams";
import { useCollectionsStore } from "@/stores/collections";

export function useCurrentCollection() {
  const { collectionSlug } = useRouteParams();
  const collectionsStore = useCollectionsStore();

  const currentCollection = computed(() => {
    if (!collectionSlug.value) return null;
    return collectionsStore.collections.find((c) => c.slug === collectionSlug.value) || null;
  });

  const isLoading = computed(() => collectionsStore.isLoading);

  return {
    currentCollection,
    isLoading
  };
}
