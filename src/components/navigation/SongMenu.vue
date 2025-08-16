<script setup lang="ts">
import { Edit, LockKeyhole, Menu, Music, X } from "lucide-vue-next";
import { computed, ref } from "vue";

import AuthStatus from "@/components/auth/AuthStatus.vue";
import { useCurrentCollection } from "@/composables/useCurrentCollection";
import { useCurrentSong } from "@/composables/useCurrentSong";
import { useCollectionsStore } from "@/stores/collections";

const emit = defineEmits<{
  (e: "toggle-edit"): void;
}>();

const isOpen = ref(false);

const collectionsStore = useCollectionsStore();
const { currentCollection } = useCurrentCollection();
const { currentSong } = useCurrentSong();

const songMenuItems = computed(() => {
  return collectionsStore.songs;
});

const otherCollectionMenuItems = computed(() => {
  return collectionsStore.collections.filter(
    (collection) => collection.slug !== currentCollection.value?.slug
  );
});
</script>

<template>
  <div class="flex items-center gap-4">
    <div class="drawer">
      <input id="my-drawer" v-model="isOpen" type="checkbox" class="drawer-toggle" />
      <div class="drawer-content">
        <label class="btn btn-square btn-primary btn-lg flex-shrink-0" htmlFor="my-drawer">
          <Menu class="h-5 w-5" />
        </label>
      </div>
      <div class="drawer-side z-50">
        <label htmlFor="my-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
        <div class="flex min-h-full w-80 lg:p-3">
          <div
            class="from-primary/12 bg-base-100/75 text-base-content border-base-200 lg:rounded-box flex w-full flex-col gap-6 border bg-linear-to-t px-3 py-4 shadow-lg backdrop-blur-lg lg:px-1"
          >
            <div v-if="currentCollection" class="flex flex-col gap-2">
              <div class="flex items-center justify-between gap-2 pr-3 pl-5">
                <span class="text-base-content/60 font-medium tracking-wide uppercase">{{
                  currentCollection?.title
                }}</span>
                <div class="flex items-center gap-2">
                  <button
                    v-if="collectionsStore.canEditCurrentCollection"
                    class="btn btn-circle btn-soft btn-sm"
                    @click="
                      emit('toggle-edit');
                      isOpen = false;
                    "
                  >
                    <Edit class="size-4" />
                  </button>
                  <button class="btn btn-circle btn-soft btn-sm" @click="isOpen = false">
                    <X class="size-4" />
                  </button>
                </div>
              </div>
              <ul v-if="songMenuItems.length > 0" class="menu w-full">
                <li v-for="song in songMenuItems" :key="song.id">
                  <router-link
                    :to="{
                      name: 'song',
                      params: {
                        collectionSlug: currentCollection?.slug,
                        songSlug: song.slug
                      }
                    }"
                    :class="{
                      'menu-focus': currentSong?.id === song.id
                    }"
                    @click="isOpen = false"
                  >
                    <LockKeyhole v-if="!song.visible" class="text-primary size-3" />
                    {{ song.title }}
                  </router-link>
                </li>
              </ul>
              <div v-else class="px-5">
                <div
                  class="text-base-content/60 rounded-box bg-base-100/70 my-3 flex items-center gap-2 px-3 py-2 text-sm"
                >
                  <Music class="size-3.5 opacity-60" />
                  <span class="italic">Esta colección no tiene canciones</span>
                </div>
              </div>
            </div>
            <div v-if="otherCollectionMenuItems.length > 0" class="flex flex-col gap-2">
              <span class="text-base-content/60 px-5 text-sm font-medium tracking-wide uppercase"
                >Otras colecciones</span
              >
              <ul class="menu w-full">
                <li v-for="otherCollection in otherCollectionMenuItems" :key="otherCollection.id">
                  <router-link
                    :to="{
                      name: 'collection',
                      params: {
                        collectionSlug: otherCollection.slug
                      }
                    }"
                    @click="isOpen = false"
                  >
                    {{ otherCollection.title }}
                  </router-link>
                </li>
              </ul>
            </div>
            <div class="flex-grow-1" />
            <div class="flex items-center justify-between gap-2 pr-3 pl-4 opacity-60">
              <AuthStatus class="w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
