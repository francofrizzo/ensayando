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

  const currentSongIndex = computed(() => {
    if (!currentSong.value) return -1;
    return collectionsStore.songs.findIndex((s) => s.id === currentSong.value!.id);
  });

  const prevSong = computed(() => {
    const idx = currentSongIndex.value;
    if (idx <= 0) return null;
    return collectionsStore.songs[idx - 1] ?? null;
  });

  const nextSong = computed(() => {
    const idx = currentSongIndex.value;
    if (idx < 0 || idx >= collectionsStore.songs.length - 1) return null;
    return collectionsStore.songs[idx + 1] ?? null;
  });

  const isLoading = computed(() => collectionsStore.isLoading);

  return {
    currentSong,
    prevSong,
    nextSong,
    isLoading
  };
}
