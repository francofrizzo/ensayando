<script setup lang="ts">
import { Edit, LockKeyhole, Menu, X } from "lucide-vue-next";
import { computed, ref } from "vue";

import AuthStatus from "@/components/auth/AuthStatus.vue";
import { useCurrentSong } from "@/composables/useCurrentSong";
import type { Collection } from "@/data/types";
import { useAuthStore } from "@/stores/auth";
import { useCollectionsStore } from "@/stores/collections";

const props = defineProps<{
  collection: Collection;
}>();

const emit = defineEmits<{
  (e: "toggle-edit"): void;
}>();

const isOpen = ref(false);

const collectionsStore = useCollectionsStore();
const { currentSong } = useCurrentSong();
const authStore = useAuthStore();

const songMenuItems = computed(() => {
  return collectionsStore.songs;
});

const otherCollectionMenuItems = computed(() => {
  return collectionsStore.collections.filter(
    (collection) => collection.slug !== props.collection.slug
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
            class="bg-base-100/75 text-base-content border-base-200 lg:rounded-box flex w-full flex-col gap-6 border px-3 py-4 shadow-lg backdrop-blur-lg lg:px-1"
          >
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between gap-2 pr-3 pl-5">
                <span class="text-base-content/60 font-medium tracking-wide uppercase">{{
                  collection.title
                }}</span>
                <button class="btn btn-circle btn-soft btn-sm" @click="isOpen = false">
                  <X class="size-4" />
                </button>
              </div>
              <ul class="menu w-full">
                <li v-for="song in songMenuItems" :key="song.id">
                  <router-link
                    :to="{
                      name: 'song',
                      params: {
                        collectionSlug: collection.slug,
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
                    <LockKeyhole v-if="!otherCollection.visible" class="text-primary size-3" />
                    {{ otherCollection.title }}
                  </router-link>
                </li>
              </ul>
            </div>
            <div class="flex-grow-1" />
            <div class="flex items-center justify-between gap-2 pr-3 pl-4 opacity-60">
              <AuthStatus class="grow-0" />
              <button
                v-if="authStore.isAuthenticated"
                class="btn btn-circle btn-ghost btn-sm"
                @click="
                  emit('toggle-edit');
                  isOpen = false;
                "
              >
                <Edit class="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
