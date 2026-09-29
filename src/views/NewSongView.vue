<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import { onBeforeRouteLeave, useRouter } from "vue-router";

import EditBar from "@/components/editor/EditBar.vue";
import SongTab from "@/components/editor/SongTab.vue";
import UnsavedChangesDialog from "@/components/editor/UnsavedChangesDialog.vue";
import ErrorMessage from "@/components/ui/ErrorMessage.vue";
import LoadingScreen from "@/components/ui/LoadingScreen.vue";
import RoomLight from "@/components/ui/RoomLight.vue";
import { useCollectionTheme } from "@/composables/useCollectionTheme";
import { useCurrentCollection } from "@/composables/useCurrentCollection";
import { provideEditorSession } from "@/composables/useEditorSession";
import { useRouteParams } from "@/composables/useRouteParams";
import { useCollectionsStore } from "@/stores/collections";

// /:collectionSlug/nueva — the song form in create mode, with the same edit bar.
// Creating the song replaces this route with the new song in edit mode.
const router = useRouter();
const collectionsStore = useCollectionsStore();
const { collectionSlug } = useRouteParams();
const { currentCollection } = useCurrentCollection();
useCollectionTheme(currentCollection);

const editor = provideEditorSession();
const canEdit = computed(() => collectionsStore.canEditCurrentCollection);

onMounted(async () => {
  if (collectionsStore.collections.length === 0) {
    await collectionsStore.fetchCollections();
  }
  await collectionsStore.ensureCollectionLoaded(collectionSlug.value);
});

const exit = () => {
  void router.push({ name: "collection", params: { collectionSlug: collectionSlug.value } });
};

onBeforeRouteLeave(async () => {
  if (!editor.isDirty.value) return true;
  const choice = await editor.confirmLeave();
  if (choice === "stay") return false;
  if (choice === "save") return await editor.save();
  await editor.discard();
  return true;
});

const onBeforeUnload = (event: BeforeUnloadEvent) => {
  if (editor.isDirty.value) {
    event.preventDefault();
    event.returnValue = "";
  }
};
const onSaveShortcut = (event: KeyboardEvent) => {
  if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "s") {
    event.preventDefault();
    event.stopPropagation();
    void editor.save();
  }
};
onMounted(() => {
  window.addEventListener("beforeunload", onBeforeUnload);
  window.addEventListener("keydown", onSaveShortcut, true);
});
onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", onBeforeUnload);
  window.removeEventListener("keydown", onSaveShortcut, true);
});
</script>

<template>
  <LoadingScreen v-if="collectionsStore.isLoading" />

  <ErrorMessage
    v-else-if="!currentCollection"
    type="collection-not-found"
    :back-link="{ to: { name: 'home' }, text: 'Volver al inicio' }"
  />

  <ErrorMessage
    v-else-if="!canEdit"
    type="not-found"
    :back-link="{
      to: { name: 'collection', params: { collectionSlug: currentCollection.slug } },
      text: 'Volver a la colección'
    }"
  />

  <div v-else class="bg-base-200 relative isolate flex h-dvh min-w-0 flex-col overflow-hidden">
    <RoomLight :collection="currentCollection" />

    <div
      class="relative z-20 px-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] md:px-3.5 md:pt-3.5"
    >
      <EditBar
        eyebrow="Nueva canción"
        :title="currentCollection.title"
        :show-tabs="false"
        :show-json="false"
        save-label="Crear canción"
        @exit="exit"
      />
    </div>

    <div
      class="relative z-10 flex min-h-0 flex-1 flex-col px-2.5 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] md:px-3.5 md:pt-3 md:pb-3.5"
    >
      <div
        class="bg-base-100 rounded-box ring-base-content/8 mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-hidden shadow-sm ring-1"
      >
        <SongTab />
      </div>
    </div>

    <UnsavedChangesDialog />
  </div>
</template>
