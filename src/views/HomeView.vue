<script setup lang="ts">
import { onMounted } from "vue";

import ErrorMessage from "@/components/ui/ErrorMessage.vue";
import LoadingScreen from "@/components/ui/LoadingScreen.vue";
import { useNavigation } from "@/composables/useNavigation";
import { useCollectionsStore } from "@/stores/collections";

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

  <div v-else class="flex min-h-dvh items-center justify-center">
    <LoadingScreen />
  </div>
</template>
