import * as supabase from "@/data/supabase";
import { type Collection, type LyricStanza, type Song } from "@/data/types";
import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";

export const useCollectionsStore = defineStore("collections", () => {
  // Data state
  const collections = ref<Collection[]>([]);
  const songs = ref<Song[]>([]);
  const isLoadingCollections = ref(false);
  const isLoadingSongs = ref(false);
  const songsCollectionId = ref<number | null>(null); // Track which collection the loaded songs belong to

  // Lyrics state
  const localLyrics = {
    value: ref<LyricStanza[]>([]),
    isDirty: ref(false),
    isSaving: ref(false)
  };

  // Route-reactive computed properties
  const route = useRoute();

  const currentCollection = computed(() => {
    const slug = route.params.collectionSlug as string;
    if (!slug) return null;
    return collections.value.find((c) => c.slug === slug) || null;
  });

  const currentSong = computed(() => {
    const slug = route.params.songSlug as string;
    if (!slug) return null;
    return songs.value.find((s) => s.slug === slug) || null;
  });

  // Auto-fetch songs when collection changes
  watch(
    currentCollection,
    async (collection, previousCollection) => {
      if (collection?.id !== previousCollection?.id) {
        songs.value = [];
        songsCollectionId.value = null;
      }
      if (collection) {
        await fetchSongsByCollectionId(collection.id);
      }
    },
    { immediate: true }
  );

  // Update local lyrics when song changes
  watch(
    currentSong,
    (song) => {
      if (song) {
        localLyrics.value.value = song.lyrics ?? [];
        localLyrics.isDirty.value = false;
      }
    },
    { immediate: true }
  );

  // Data fetching methods (no navigation logic)
  async function fetchCollections() {
    isLoadingCollections.value = true;
    const { data, error } = await supabase.fetchCollections();
    if (!error) {
      collections.value = data;
    } else {
      console.error(error);
    }
    isLoadingCollections.value = false;
  }

  async function fetchSongsByCollectionId(collectionId: number) {
    isLoadingSongs.value = true;
    const { data, error } = await supabase.fetchSongsByCollectionId(collectionId);
    if (!error) {
      songs.value = data;
      songsCollectionId.value = collectionId;
    } else {
      console.error(error);
    }
    isLoadingSongs.value = false;
  }

  async function updateLocalLyrics(value: LyricStanza[]) {
    localLyrics.value.value = value;
    localLyrics.isDirty.value = true;
  }

  async function saveLyrics() {
    localLyrics.isSaving.value = true;
    if (currentSong.value) {
      const { error } = await supabase.updateSongLyrics(
        currentSong.value.id,
        localLyrics.value.value
      );
      if (error) {
        throw error;
      } else {
        localLyrics.isDirty.value = false;
      }
    }
    localLyrics.isSaving.value = false;
  }

  const isLoading = computed(() => {
    return isLoadingCollections.value || isLoadingSongs.value;
  });

  return {
    collections,
    songs,
    currentCollection,
    currentSong,
    songsCollectionId,
    isLoading,
    fetchCollections,
    fetchSongsByCollectionId,
    localLyrics,
    updateLocalLyrics,
    saveLyrics
  };
});
