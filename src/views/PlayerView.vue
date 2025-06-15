<script setup lang="ts">
import MultitrackPlayer from "@/components/MultitrackPlayer.vue";
import { useCollectionsStore } from "@/stores/collections";
import { Rabbit } from "lucide-vue-next";

import { onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

const props = defineProps<{
  collectionSlug?: string;
  songSlug?: string;
}>();

const route = useRoute();
const router = useRouter();
const collectionsStore = useCollectionsStore();

// Load collection and song based on route parameters
onMounted(async () => {
  // Get collections
  await collectionsStore.fetchCollections();

  // If we have route parameters, use them
  if (props.collectionSlug) {
    await collectionsStore.selectCollection(props.collectionSlug);

    if (props.songSlug) {
      collectionsStore.selectSong(props.songSlug);
    } else if (collectionsStore.songs?.length > 0) {
      // If no song specified but we have songs, select the first one
      collectionsStore.selectSong(collectionsStore.songs[0]!.slug);
      router.push({
        name: "song",
        params: {
          collectionId: props.collectionSlug,
          songId: collectionsStore.songs[0]!.id
        }
      });
    }
  } else if (collectionsStore.collections.length > 0) {
    // If no collection specified, select the first available one
    const defaultCollection =
      collectionsStore.collections.find((c) => c.visible !== false) ||
      collectionsStore.collections[0];
    if (defaultCollection) {
      await collectionsStore.selectCollection(defaultCollection.slug);
      if (collectionsStore.songs.length > 0) {
        collectionsStore.selectSong(collectionsStore.songs[0]!.slug);
        router.push({
          name: "song",
          params: {
            collectionId: defaultCollection.id,
            songId: collectionsStore.songs[0]!.id
          }
        });
      }
    }
  }
});

// Update the route when collection or song changes
watch(
  () => collectionsStore.selectedCollection,
  (collection) => {
    if (collection && route.params.collectionSlug !== collection.slug) {
      if (collectionsStore.selectedSong) {
        router.push({
          name: "song",
          params: {
            collectionSlug: collection.slug,
            songSlug: collectionsStore.selectedSong.slug
          }
        });
      } else {
        router.push({ name: "collection", params: { collectionId: collection.id } });
      }
    }
  }
);

watch(
  () => collectionsStore.selectedSong,
  (song) => {
    if (song && collectionsStore.selectedCollection) {
      router.push({
        name: "song",
        params: {
          collectionSlug: collectionsStore.selectedCollection.slug,
          songSlug: song.slug
        }
      });
    }
  }
);
</script>

<template>
  <LoadingScreen v-if="collectionsStore.isLoading" />
  <MultitrackPlayer
    v-else-if="collectionsStore.selectedCollection && collectionsStore.selectedSong"
    :key="collectionsStore.selectedSong.id"
    :collection="collectionsStore.selectedCollection"
    :song="collectionsStore.selectedSong"
    :lyrics="collectionsStore.localLyrics.value"
  />
  <div
    v-else
    class="flex flex-col gap-4 flex-grow-1 min-h-dvh items-center justify-center max-w-md mx-auto text-center"
  >
    <Rabbit class="size-22 opacity-50" />
    <h2 class="text-2xl font-semibold text-base-content/80">No hay nada por acá</h2>
    <p class="text-base-content/40" v-if="collectionsStore.collections.length === 0">
      No hay colecciones disponibles.
    </p>
    <p
      class="text-base-content/40"
      v-else-if="collectionsStore.selectedCollection && collectionsStore.songs.length === 0"
    >
      Esta colección no tiene canciones. Las canciones aparecerán acá una vez que se agreguen a la
      colección.
    </p>
    <p class="text-base-content/40" v-else>No encontramos lo que estabas buscando.</p>
  </div>
</template>
