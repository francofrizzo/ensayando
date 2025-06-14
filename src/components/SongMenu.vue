<script setup lang="ts">
import type { Collection } from "@/data/collection.types";
import { useSongsStore } from "@/stores/songs";
import { Menu } from "lucide-vue-next";
import { computed } from "vue";

const props = defineProps<{
  collection: Collection;
}>();

const songsStore = useSongsStore();

const songMenuItems = computed(() => {
  return songsStore.songs
    .filter((song) => song.collectionId === props.collection.id)
    .map((song) => ({
      label: song.title,
      id: song.id
    }));
});

const otherCollectionMenuItems = computed(() => {
  return songsStore.collections
    .filter((collection) => collection.id !== props.collection.id && collection.enabled !== false)
    .map((collection) => ({
      label: collection.title,
      id: collection.id
    }));
});
</script>

<template>
  <div class="flex items-center gap-4">
    <div class="drawer">
      <input id="my-drawer" type="checkbox" class="drawer-toggle" />
      <div class="drawer-content">
        <label class="btn btn-square btn-primary btn-lg flex-shrink-0" htmlFor="my-drawer">
          <Menu class="w-5 h-5" />
        </label>
      </div>
      <div class="drawer-side z-50">
        <label htmlFor="my-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
        <div class="min-h-full w-80 flex lg:p-3">
          <div
            class="bg-base-100/75 backdrop-blur-lg px-3 py-7 flex flex-col gap-6 justify-between text-base-content shadow-lg border border-base-200 lg:rounded-box"
          >
            <div class="flex flex-col gap-2">
              <span class="text-base-content/60 font-medium uppercase px-5 tracking-wide">{{
                collection.title
              }}</span>
              <ul class="menu w-full">
                <li>
                  <a
                    v-for="song in songMenuItems"
                    :key="song.label"
                    @click="songsStore.changeSong(song.id)"
                    :class="{
                      'btn-active': songsStore.currentSong?.id === song.id
                    }"
                  >
                    {{ song.label }}
                  </a>
                </li>
              </ul>
            </div>
            <div class="flex flex-col gap-2" v-if="otherCollectionMenuItems.length > 0">
              <span class="text-base-content/60 font-medium uppercase text-sm px-5 tracking-wide"
                >Otras colecciones</span
              >
              <ul class="menu w-full">
                <li>
                  <a
                    v-for="collection in otherCollectionMenuItems"
                    :key="collection.label"
                    @click="songsStore.changeCollection(collection.id)"
                    :class="{
                      'btn-active': songsStore.currentCollection?.id === collection.id
                    }"
                  >
                    {{ collection.label }}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
