<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useCollectionsStore } from "@/stores/collections";
import { useCurrentCollection } from "@/composables/useCurrentCollection";
import { useCurrentSong } from "@/composables/useCurrentSong";
import MultitrackPlayer from "@/components/MultitrackPlayer.vue";
import LoadingScreen from "@/components/LoadingScreen.vue";
import ErrorMessage from "@/components/ErrorMessage.vue";

const collectionsStore = useCollectionsStore();
const { currentCollection } = useCurrentCollection();
const { currentSong } = useCurrentSong();

const isLoading = computed(() => collectionsStore.isLoading);

onMounted(async () => {
  if (collectionsStore.collections.length === 0) {
    await collectionsStore.fetchCollections();
  }
});
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
</template>
