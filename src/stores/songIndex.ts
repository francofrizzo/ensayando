import { defineStore } from "pinia";
import { computed, ref } from "vue";

import * as supabase from "@/data/supabase";
import type { SongIndexEntry } from "@/data/supabase";
import { useCollectionsStore } from "@/stores/collections";
import { visibleIndexSongs } from "@/utils/navigation";

// Every readable song across collections, for ⌘K and the home grid counts.
// Loaded once on demand and cached; call refresh() after creating songs.
export const useSongIndexStore = defineStore("songIndex", () => {
  const entries = ref<SongIndexEntry[]>([]);
  const loaded = ref(false);
  let pending: Promise<void> | null = null;

  const collectionsStore = useCollectionsStore();

  const songs = computed(() => visibleIndexSongs(entries.value, collectionsStore.collections));

  const countByCollection = computed(() => {
    const counts = new Map<number, number>();
    for (const song of songs.value) {
      counts.set(song.collection_id, (counts.get(song.collection_id) ?? 0) + 1);
    }
    return counts;
  });

  async function refresh() {
    const { data, error } = await supabase.fetchSongIndex();
    if (error) {
      console.error(error);
      return;
    }
    entries.value = data ?? [];
    loaded.value = true;
  }

  function ensureLoaded() {
    if (loaded.value) return Promise.resolve();
    pending ??= refresh().finally(() => {
      pending = null;
    });
    return pending;
  }

  function reset() {
    entries.value = [];
    loaded.value = false;
  }

  return { songs, countByCollection, loaded, ensureLoaded, refresh, reset };
});
