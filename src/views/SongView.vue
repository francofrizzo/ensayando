<script setup lang="ts">
import ErrorMessage from "@/components/ErrorMessage.vue";
import LoadingScreen from "@/components/LoadingScreen.vue";
import MultitrackPlayer from "@/components/MultitrackPlayer.vue";
import { useCollectionTheme } from "@/composables/useCollectionTheme";
import { useCurrentCollection } from "@/composables/useCurrentCollection";
import { useCurrentSong } from "@/composables/useCurrentSong";
import { useCollectionsStore } from "@/stores/collections";
import { computed, onMounted } from "vue";

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
