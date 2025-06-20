import { computed } from "vue";

import { useRouteParams } from "@/composables/useRouteParams";
import { useCollectionsStore } from "@/stores/collections";

export function useCurrentSong() {
  const { songSlug } = useRouteParams();
  const collectionsStore = useCollectionsStore();

  const currentSong = computed(() => {
    if (!songSlug.value) return null;
    return collectionsStore.songs.find((s) => s.slug === songSlug.value) || null;
  });

  const isLoading = computed(() => collectionsStore.isLoading);

  return {
    currentSong,
    isLoading
  };
}
