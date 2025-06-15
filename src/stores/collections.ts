import * as supabase from "@/data/supabase";
import { type Collection, type LyricStanza, type Song } from "@/data/types";
import { defineStore } from "pinia";
import { computed, ref } from "vue";

export const useCollectionsStore = defineStore("collections", () => {
  const collections = ref<Collection[]>([]);
  const isLoadingCollections = ref(false);
  const songs = ref<Song[]>([]);
  const isLoadingSongs = ref(false);

  const selectedCollectionId = ref<number | null>(null);
  const selectedSongId = ref<number | null>(null);

  const localLyrics = {
    value: ref<LyricStanza[]>([]),
    isDirty: ref(false),
    isSaving: ref(false)
  };

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
    } else {
      console.error(error);
    }
    isLoadingSongs.value = false;
  }

  async function selectCollection(slug: string) {
    const collection = collections.value?.find((collection) => collection.slug === slug);
    if (collection) {
      selectedCollectionId.value = collection.id;
      await fetchSongsByCollectionId(collection.id);
    }
  }

  async function selectSong(slug: string) {
    const song = songs.value?.find((song) => song.slug === slug);
    if (song) {
      selectedSongId.value = song.id;
      localLyrics.value.value = song.lyrics ?? [];
    }
  }

  async function updateLocalLyrics(value: LyricStanza[]) {
    localLyrics.value.value = value;
    localLyrics.isDirty.value = true;
  }

  async function saveLyrics() {
    localLyrics.isSaving.value = true;
    if (selectedSongId.value) {
      const { error } = await supabase.updateSongLyrics(
        selectedSongId.value,
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

  const selectedCollection = computed(() => {
    return (
      collections.value?.find((collection) => collection.id === selectedCollectionId.value) ?? null
    );
  });

  const selectedSong = computed(() => {
    return songs.value?.find((song) => song.id === selectedSongId.value) ?? null;
  });

  const isLoading = computed(() => {
    return isLoadingCollections.value || isLoadingSongs.value;
  });

  return {
    collections,
    songs,
    isLoading,
    fetchCollections,
    fetchSongsByCollectionId,
    selectCollection,
    selectSong,
    selectedCollection,
    selectedSong,
    localLyrics,
    updateLocalLyrics,
    saveLyrics
  };
});
