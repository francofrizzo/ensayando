<script setup lang="ts">
import ErrorMessage from "@/components/ErrorMessage.vue";
import LoadingScreen from "@/components/LoadingScreen.vue";
import { useNavigation } from "@/composables/useNavigation";
import { useCollectionsStore } from "@/stores/collections";
import { onMounted } from "vue";

const collectionsStore = useCollectionsStore();
const { replaceToCollection } = useNavigation();

onMounted(async () => {
  if (collectionsStore.collections.length === 0) {
    await collectionsStore.fetchCollections();
  }

  if (collectionsStore.collections.length > 0) {
    const defaultCollection = collectionsStore.collections[0]; // Store already filters visible collections

    if (defaultCollection) {
      replaceToCollection(defaultCollection);
    }
  }
});
</script>

<template>
  <LoadingScreen v-if="collectionsStore.isLoading" />

  <ErrorMessage v-else-if="collectionsStore.collections.length === 0" type="no-collections" />

  <div v-else class="flex items-center justify-center min-h-dvh">
    <LoadingScreen />
  </div>
</template>
