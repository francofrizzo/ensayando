<script setup lang="ts">
import {
  IconGlobe,
  IconLibrary,
  IconLink,
  IconLock,
  IconPlus,
  IconSearch
} from "@/components/ui/icons";
import { computed, onMounted, ref } from "vue";

import AccountMenu from "@/components/navigation/AccountMenu.vue";
import ErrorMessage from "@/components/ui/ErrorMessage.vue";
import LoadingScreen from "@/components/ui/LoadingScreen.vue";
import RoomLight from "@/components/ui/RoomLight.vue";
import { useNavigation } from "@/composables/useNavigation";
import type { CollectionVisibility, CollectionWithRole } from "@/data/types";
import { useAuthStore } from "@/stores/auth";
import { useCollectionsStore } from "@/stores/collections";
import { useSongIndexStore } from "@/stores/songIndex";
import { useUIStore } from "@/stores/ui";
import {
  bannerBackground,
  collectionInitials,
  directCollection,
  ROLE_LABELS,
  songCountLabel,
  VISIBILITY_LABELS
} from "@/utils/navigation";
import { resolveCollectionPalette } from "@/utils/palette";

const collectionsStore = useCollectionsStore();
const songIndex = useSongIndexStore();
const authStore = useAuthStore();
const uiStore = useUIStore();
const { replaceToCollection } = useNavigation();

// Until we know whether to go straight into a collection, show the loader.
const resolved = ref(false);

onMounted(async () => {
  if (collectionsStore.collections.length === 0) {
    await collectionsStore.fetchCollections();
  }
  const only = directCollection(collectionsStore.collections);
  if (only) {
    replaceToCollection(only);
    return;
  }
  resolved.value = true;
  void songIndex.ensureLoaded();
});

// The person's own collections first; public ones they only visit after.
const cards = computed(() =>
  [...collectionsStore.collections].sort(
    (a, b) => Number(Boolean(b.is_member)) - Number(Boolean(a.is_member))
  )
);

const visibilityIcon: Record<CollectionVisibility, typeof IconGlobe> = {
  public: IconGlobe,
  unlisted: IconLink,
  private: IconLock
};

const banner = (collection: CollectionWithRole) =>
  bannerBackground(resolveCollectionPalette(collection).main);

const count = (collection: CollectionWithRole) => songIndex.countByCollection.get(collection.id);
</script>

<template>
  <LoadingScreen v-if="collectionsStore.isLoading || (!resolved && cards.length > 0)" />

  <ErrorMessage v-else-if="cards.length === 0" type="no-collections" />

  <div v-else class="bg-base-200 relative isolate h-dvh">
    <RoomLight />
    <!-- html and body don't scroll (styles.css): the page scrolls in its own box -->
    <div class="h-full overflow-y-auto overscroll-contain">
      <header
        class="glass-1 fixed inset-x-2.5 top-[max(10px,env(safe-area-inset-top))] z-10 flex h-14 items-center gap-3 rounded-[18px] pr-2.5 pl-3 sm:inset-x-3.5 sm:top-3.5 sm:h-[60px]"
      >
        <button
          type="button"
          class="btn btn-circle btn-ghost btn-sm -mr-1"
          aria-label="Abrir biblioteca"
          :aria-expanded="uiStore.libraryOpen"
          @click="uiStore.openLibrary()"
        >
          <IconLibrary class="size-[18px]" />
        </button>
        <img src="/pwa-192x192.png" alt="" class="size-[34px] rounded-[9px]" />
        <span class="font-display text-lg font-bold">Ensayando</span>
        <span class="flex-1" />
        <button
          type="button"
          class="btn btn-circle btn-ghost btn-sm"
          aria-label="Buscar"
          title="Buscar (⌘K)"
          @click="uiStore.openCommandPalette()"
        >
          <IconSearch class="size-[18px]" />
        </button>
        <AccountMenu />
      </header>

      <main
        class="mx-auto grid max-w-[1180px] grid-cols-1 gap-3 px-4 pt-[calc(max(10px,env(safe-area-inset-top))+72px)] pb-8 sm:grid-cols-2 sm:gap-5 sm:px-10 sm:pt-[108px] lg:grid-cols-3 lg:px-16"
      >
        <RouterLink
          v-for="(collection, index) in cards"
          :key="collection.id"
          :to="{ name: 'collection', params: { collectionSlug: collection.slug } }"
          class="glass-2 group flex flex-col gap-2.5 rounded-[18px] p-2.5 transition-transform duration-200 hover:-translate-y-0.5 sm:gap-3.5 sm:rounded-[20px] sm:p-3"
          :style="{
            animation: `empty-stagger 400ms ease-out both`,
            animationDelay: `${index * 60}ms`
          }"
          data-testid="collection-card"
        >
          <div
            class="relative h-16 overflow-hidden rounded-[13px] shadow-[inset_0_0_0_1px_oklch(100%_0_0/0.14)] sm:aspect-[16/7] sm:h-auto"
            :style="collection.artwork_playback_url ? {} : { backgroundImage: banner(collection) }"
            aria-hidden="true"
          >
            <img
              v-if="collection.artwork_playback_url"
              :src="collection.artwork_playback_url"
              alt=""
              class="absolute inset-0 size-full object-cover"
            />
            <span
              v-else
              class="font-display absolute bottom-[8%] left-[5%] text-[26px] leading-[0.9] font-extrabold text-white/90 sm:text-5xl"
              >{{ collectionInitials(collection.title) }}</span
            >
          </div>
          <div class="flex flex-col gap-2 px-0 pb-0 sm:px-1.5 sm:pb-1.5">
            <b class="font-display text-[17px] leading-[1.05] font-bold sm:text-xl">{{
              collection.title
            }}</b>
            <div class="flex flex-wrap items-center gap-1.5">
              <span
                v-if="count(collection) !== undefined"
                class="badge badge-sm bg-base-content/7 text-base-content/70 border-0"
                >{{ songCountLabel(count(collection)!) }}</span
              >
              <span
                v-if="collection.is_member"
                class="badge badge-sm bg-base-content/7 text-base-content/70 border-0"
                >{{ ROLE_LABELS[collection.user_role] }}</span
              >
              <span class="badge badge-sm bg-base-content/7 text-base-content/70 gap-1 border-0">
                <component :is="visibilityIcon[collection.visibility]" class="size-3" />
                {{ VISIBILITY_LABELS[collection.visibility] }}
              </span>
            </div>
          </div>
        </RouterLink>
        <RouterLink
          v-if="authStore.isAppAdmin"
          :to="{ name: 'new-collection' }"
          class="border-base-content/25 text-base-content/70 hover:border-base-content/45 hover:bg-base-content/5 flex min-h-24 flex-col items-center justify-center gap-2 rounded-[18px] border-2 border-dashed p-4 font-semibold transition-colors sm:rounded-[20px]"
          data-testid="new-collection-card"
        >
          <IconPlus class="size-6" aria-hidden="true" />
          Nueva colección
        </RouterLink>
      </main>
    </div>
  </div>
</template>
