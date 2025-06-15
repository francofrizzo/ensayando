import type { Collection, Song } from "@/data/types";
import { useRouter } from "vue-router";

export function useNavigation() {
  const router = useRouter();

  const navigateToHome = () => {
    router.push({ name: "home" });
  };

  const navigateToCollection = (collection: Collection) => {
    router.push({
      name: "collection",
      params: { collectionSlug: collection.slug }
    });
  };

  const navigateToSong = (collection: Collection, song: Song) => {
    router.push({
      name: "song",
      params: {
        collectionSlug: collection.slug,
        songSlug: song.slug
      }
    });
  };

  const navigateToFirstSong = (collection: Collection, songs: Song[]) => {
    const firstSong = songs.find((s) => s.visible) || songs[0];
    if (firstSong) {
      navigateToSong(collection, firstSong);
    }
  };

  const replaceToCollection = (collection: Collection) => {
    router.replace({
      name: "collection",
      params: { collectionSlug: collection.slug }
    });
  };

  const replaceToSong = (collection: Collection, song: Song) => {
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
