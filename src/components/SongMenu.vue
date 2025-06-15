<script setup lang="ts">
import type { Collection } from "@/data/types";
import { useAuthStore } from "@/stores/auth";
import { useCollectionsStore } from "@/stores/collections";
import { Edit, LockKeyhole, Menu, X } from "lucide-vue-next";
import { computed, ref } from "vue";

const props = defineProps<{
  collection: Collection;
}>();

const emit = defineEmits<{
  (e: "toggle-edit"): void;
}>();

const isOpen = ref(false);

const collectionsStore = useCollectionsStore();
const authStore = useAuthStore();

const songMenuItems = computed(() => {
  return collectionsStore.songs.filter((song) => authStore.isAuthenticated() || song.visible);
});

const otherCollectionMenuItems = computed(() => {
  return collectionsStore.collections.filter(
    (collection) =>
      collection.slug !== props.collection.slug &&
      (authStore.isAuthenticated() || collection.visible !== false)
  );
});
</script>

<template>
  <div class="flex items-center gap-4">
    <div class="drawer">
      <input id="my-drawer" type="checkbox" class="drawer-toggle" v-model="isOpen" />
      <div class="drawer-content">
        <label class="btn btn-square btn-primary btn-lg flex-shrink-0" htmlFor="my-drawer">
          <Menu class="w-5 h-5" />
        </label>
      </div>
      <div class="drawer-side z-50">
        <label htmlFor="my-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
        <div class="min-h-full w-80 flex lg:p-3">
          <div
            class="bg-base-100/75 backdrop-blur-lg w-full px-3 lg:px-1 py-4 flex flex-col gap-6 text-base-content shadow-lg border border-base-200 lg:rounded-box"
          >
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between gap-2 pl-5 pr-3">
                <span class="text-base-content/60 font-medium uppercase tracking-wide">{{
                  collection.title
                }}</span>
                <button class="btn btn-circle btn-soft btn-sm" @click="isOpen = false">
                  <X class="size-4" />
                </button>
              </div>
              <ul class="menu w-full">
                <li>
                  <a
                    v-for="song in songMenuItems"
                    :key="song.title"
                    @click="collectionsStore.selectSong(song.slug)"
                    :class="{
                      'menu-focus': collectionsStore.selectedSong?.id === song.id
                    }"
                  >
                    <LockKeyhole v-if="!song.visible" class="size-3 text-primary" />
                    {{ song.title }}
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
                    :key="collection.title"
                    @click="collectionsStore.selectCollection(collection.slug)"
                    :class="{
                      'menu-focus': collectionsStore.selectedCollection?.id === collection.id
                    }"
                  >
                    <LockKeyhole v-if="!collection.visible" class="size-3 text-primary" />
                    {{ collection.title }}
                  </a>
                </li>
              </ul>
            </div>
            <div class="flex-grow-1" />
            <div class="flex items-center justify-end gap-2 pl-5 pr-3 opacity-60">
              <button
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
