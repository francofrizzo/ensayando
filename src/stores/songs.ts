import type { Collection } from "@/data/collection.types";
import type { Song } from "@/data/song.types";
import { defineStore } from "pinia";
import { ref } from "vue";

const fetchJson = async (path: string) => {
  const res = await fetch(`${import.meta.env.VITE_JSON_STORAGE_BASE_URL}/${path}`, {
    headers: import.meta.env.VITE_JSON_STORAGE_ACCESS_KEY
      ? {
          "X-Access-Key": import.meta.env.VITE_JSON_STORAGE_ACCESS_KEY
        }
      : undefined
  });
  const data = await res.json();
  if ("record" in data) {
    return data.record;
  }
  return data;
};

export const useSongsStore = defineStore("songs", () => {
  const collections = ref<Collection[]>([]);
  const songs = ref<Song[]>([]);

  const currentCollection = ref<Collection | undefined>(undefined);
  const currentSong = ref<Song | undefined>(undefined);
  const initialized = ref<boolean>(false);

  async function initializeCollections() {
    if (initialized.value) return;

    try {
      collections.value = await fetchJson(import.meta.env.VITE_COLLECTIONS_JSON_PATH);
      initialized.value = true;

      // Don't automatically load a collection as we'll rely on route params
      return collections.value;
    } catch (error) {
      console.error("Error loading collections:", error);
      return [];
    }
  }

  async function changeCollection(id: string) {
    const collection = collections.value.find((collection) => collection.id === id);
    if (!collection) return;

    currentCollection.value = collection;
    // Reset songs and current song before loading new ones
    // songs.value = []
    currentSong.value = undefined;

    // Load songs for the selected collection
    try {
      const songsData = await fetchJson(collection.songsFile);
      songs.value = songsData.map((song: any) => ({
        ...song,
        collectionId: collection.id
      }));
      return songs.value;
    } catch (error) {
      console.error(`Error loading songs for collection ${collection.id}:`, error);
      return [];
    }
  }

  function changeSong(id: string) {
    const matchingSong = songs.value.find((song) => song.id === id);
    if (matchingSong) {
      currentSong.value = matchingSong;
    }
  }

  function getSongById(id: string) {
    return songs.value.find((song) => song.id === id);
  }

  function getCollectionById(id: string) {
    return collections.value.find((collection) => collection.id === id);
  }

  return {
    collections,
    songs,
    currentCollection,
    currentSong,
    initialized,
    initializeCollections,
    changeSong,
    changeCollection,
    getSongById,
    getCollectionById
  };
});
