<script setup lang="ts">
import ErrorMessage from "@/components/ErrorMessage.vue";
import LoadingScreen from "@/components/LoadingScreen.vue";
import { useCurrentCollection } from "@/composables/useCurrentCollection";
import { useNavigation } from "@/composables/useNavigation";
import { useCollectionsStore } from "@/stores/collections";
import { computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const collectionsStore = useCollectionsStore();
const { currentCollection } = useCurrentCollection();
const { replaceToSong } = useNavigation();

const isLoading = computed(() => collectionsStore.isLoading);

onMounted(async () => {
  if (collectionsStore.collections.length === 0) {
    await collectionsStore.fetchCollections();
  }
});

watch(
  [
    () => collectionsStore.songs,
    currentCollection,
    () => collectionsStore.isLoading,
    () => collectionsStore.songsCollectionId
  ],
  ([songs, collection, isLoading, songsCollectionId]) => {
    // Only redirect if:
    // 1. We have a collection
    // 2. We have songs and they're not loading
    // 3. We're on a collection route (not song route)
    // 4. Songs actually belong to the current collection (not leftover from previous collection)
    if (
      collection &&
      songs.length > 0 &&
      !isLoading &&
      !route.params.songSlug &&
      songsCollectionId === collection.id // Ensure songs belong to current collection
    ) {
      const firstSong = songs[0];

      if (firstSong) {
        replaceToSong(collection, firstSong);
      }
    }
  },
  { immediate: true }
);
</script>

<template>
  <LoadingScreen v-if="isLoading" />

  <ErrorMessage
    v-else-if="!currentCollection"
    type="collection-not-found"
    :back-link="{
      to: { name: 'home' },
      text: 'Volver al inicio'
    }"
  />

  <ErrorMessage
    v-else-if="collectionsStore.songs.length === 0 && !collectionsStore.isLoading"
    type="no-songs"
  />

  <div v-else class="flex items-center justify-center min-h-dvh">
    <LoadingScreen />
  </div>
</template>
