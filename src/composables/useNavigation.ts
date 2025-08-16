import { useRouter } from "vue-router";

import type { CollectionWithRole, Song } from "@/data/types";

export function useNavigation() {
  const router = useRouter();

  const navigateToHome = () => {
    router.push({ name: "home" });
  };

  const navigateToCollection = (collection: CollectionWithRole) => {
    router.push({
      name: "collection",
      params: { collectionSlug: collection.slug }
    });
  };

  const navigateToSong = (collection: CollectionWithRole, song: Song) => {
    router.push({
      name: "song",
      params: {
        collectionSlug: collection.slug,
        songSlug: song.slug
      }
    });
  };

  const navigateToFirstSong = (collection: CollectionWithRole, songs: Song[]) => {
    const firstSong = songs.find((s) => s.visible) || songs[0];
    if (firstSong) {
      navigateToSong(collection, firstSong);
    }
  };

  const replaceToCollection = (collection: CollectionWithRole) => {
    router.replace({
      name: "collection",
      params: { collectionSlug: collection.slug }
    });
  };

  const replaceToSong = (collection: CollectionWithRole, song: Song) => {
    router.replace({
      name: "song",
      params: {
        collectionSlug: collection.slug,
        songSlug: song.slug
      }
    });
  };

  return {
    navigateToHome,
    navigateToCollection,
    navigateToSong,
    navigateToFirstSong,
    replaceToCollection,
    replaceToSong
  };
}
