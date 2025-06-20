<script setup lang="ts">
import { computed, onMounted } from "vue";

import MultitrackPlayer from "@/components/player/MultitrackPlayer.vue";
import ErrorMessage from "@/components/ui/ErrorMessage.vue";
import LoadingScreen from "@/components/ui/LoadingScreen.vue";
import { useCollectionTheme } from "@/composables/useCollectionTheme";
import { useCurrentCollection } from "@/composables/useCurrentCollection";
import { useCurrentSong } from "@/composables/useCurrentSong";
import { useCollectionsStore } from "@/stores/collections";

const collectionsStore = useCollectionsStore();
const { currentCollection } = useCurrentCollection();
const { currentSong } = useCurrentSong();
const { themeVariables } = useCollectionTheme(currentCollection);

const isLoading = computed(() => collectionsStore.isLoading);

onMounted(async () => {
  if (collectionsStore.collections.length === 0) {
    await collectionsStore.fetchCollections();
  }
});
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
      v-else-if="!currentSong"
      type="song-not-found"
      :back-link="{
        to: { name: 'collection', params: { collectionSlug: currentCollection.slug } },
        text: 'Volver a la colección'
      }"
    />

    <MultitrackPlayer
      v-else
      :key="currentSong.id"
      :collection="currentCollection"
      :song="currentSong"
      :lyrics="collectionsStore.localLyrics.value"
    />
  </div>
</template>
