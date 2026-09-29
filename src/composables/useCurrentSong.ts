import { computed } from "vue";

import { useCollectionsStore } from "@/stores/collections";

export function useCurrentSong() {
  const collectionsStore = useCollectionsStore();

  // The store's lookup: it also resolves a song renamed in this session under its old
  // address, so the player doesn't remount while the route catches up.
  const currentSong = computed(() => collectionsStore.currentSong);

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
