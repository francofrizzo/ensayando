<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";

import ErrorMessage from "@/components/ui/ErrorMessage.vue";
import LoadingScreen from "@/components/ui/LoadingScreen.vue";
import { useCollectionTheme } from "@/composables/useCollectionTheme";
import { useCurrentCollection } from "@/composables/useCurrentCollection";
import { useNavigation } from "@/composables/useNavigation";
import { useCollectionsStore } from "@/stores/collections";

const route = useRoute();
const collectionsStore = useCollectionsStore();
const { currentCollection } = useCurrentCollection();
const { replaceToSong } = useNavigation();
const { themeVariables } = useCollectionTheme(currentCollection);

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
  <div :style="themeVariables">
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

    <div v-else class="flex min-h-dvh items-center justify-center">
      <LoadingScreen />
    </div>
  </div>
</template>
