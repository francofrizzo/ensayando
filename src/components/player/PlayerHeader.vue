<script setup lang="ts">
import LibraryButton from "@/components/navigation/LibraryButton.vue";
import { IconEdit } from "@/components/ui/icons";
import type { CollectionWithRole, Song } from "@/data/types";
import { useCollectionsStore } from "@/stores/collections";

const props = defineProps<{
  collection: CollectionWithRole;
  song: Song;
}>();

const emit = defineEmits<{
  (e: "toggle-edit"): void;
}>();

const collectionsStore = useCollectionsStore();
</script>

<template>
  <div class="flex min-w-0 items-center gap-3 to-transparent sm:gap-4">
    <LibraryButton />
    <button
      v-if="collectionsStore.canEditCurrentCollection"
      type="button"
      class="btn btn-circle btn-ghost btn-sm shrink-0"
      aria-label="Editar canción"
      title="Editar canción"
      @click="emit('toggle-edit')"
    >
      <IconEdit class="size-4" />
    </button>

    <Transition name="song-change" mode="out-in">
      <div :key="props.song.id" class="flex min-w-0 flex-col gap-1 tracking-wide">
        <span
          data-testid="song-title"
          class="font-display line-clamp-2 text-lg leading-tight font-bold text-ellipsis"
          >{{ props.song.title }}</span
        >
        <span
          class="text-base-content/50 line-clamp-1 text-xs font-medium text-ellipsis uppercase"
          >{{ props.collection.title }}</span
        >
      </div>
    </Transition>
  </div>
</template>
