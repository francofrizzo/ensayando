<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from "vue-router";

import SettingsColors from "@/components/settings/SettingsColors.vue";
import SettingsDanger from "@/components/settings/SettingsDanger.vue";
import SettingsGeneral from "@/components/settings/SettingsGeneral.vue";
import SettingsMembers from "@/components/settings/SettingsMembers.vue";
import SettingsSongs from "@/components/settings/SettingsSongs.vue";
import {
  IconBack,
  IconLibrary,
  IconLock,
  IconMembers,
  IconPalette,
  IconSettings,
  IconWarning
} from "@/components/ui/icons";
import LeaveDialog from "@/components/ui/LeaveDialog.vue";
import LoadingScreen from "@/components/ui/LoadingScreen.vue";
import RoomLight from "@/components/ui/RoomLight.vue";
import { useCollectionTheme } from "@/composables/useCollectionTheme";
import { provideSettingsGuard } from "@/composables/useSettingsGuard";
import { fetchCollectionMembers } from "@/data/admin";
import type { Collection, CollectionMember } from "@/data/types";
import { useAuthStore } from "@/stores/auth";
import { useCollectionsStore } from "@/stores/collections";
import { initials } from "@/utils/collectionSettings";

// Ajustes de colección (design/pantallas/coleccion.html): everything that used to be
// done with SQL through the admin skill. Only the collection's admins get here.
type Section = "general" | "pistas" | "canciones" | "miembros" | "peligro";

const route = useRoute();
const router = useRouter();
const collectionsStore = useCollectionsStore();
const authStore = useAuthStore();

const collection = computed(() => collectionsStore.currentCollection);
useCollectionTheme(collection);

const section = computed<Section>(() => (route.params.section as Section) || "general");

// Unsaved changes in a section: switching sections, going back or closing the tab asks first.
const guard = provideSettingsGuard();
onBeforeRouteUpdate((to, from) =>
  to.params.section !== from.params.section || to.params.collectionSlug !== from.params.collectionSlug
    ? guard.confirmLeave()
    : true
);
onBeforeRouteLeave(() => guard.confirmLeave());
const onBeforeUnload = (event: BeforeUnloadEvent) => {
  if (guard.isDirty.value) {
    event.preventDefault();
    event.returnValue = "";
  }
};
onMounted(() => window.addEventListener("beforeunload", onBeforeUnload));
onBeforeUnmount(() => window.removeEventListener("beforeunload", onBeforeUnload));
const isAdmin = computed(() => collection.value?.user_role === "admin");
const ready = ref(false);

const members = ref<CollectionMember[]>([]);
const membersError = ref("");
async function loadMembers() {
  if (!collection.value || !isAdmin.value) return;
  try {
    membersError.value = "";
    members.value = await fetchCollectionMembers(collection.value.id);
  } catch (error) {
    membersError.value = (error as Error).message;
  }
}

onMounted(async () => {
  if (collectionsStore.collections.length === 0) await collectionsStore.fetchCollections();
  await collectionsStore.ensureCollectionLoaded(route.params.collectionSlug as string);
  ready.value = true;
});

watch(
  () => [collection.value?.id, isAdmin.value],
  () => loadMembers(),
  { immediate: true }
);

const NAV: { id: Section; label: string; icon: typeof IconSettings }[] = [
  { id: "general", label: "General", icon: IconSettings },
  { id: "pistas", label: "Pistas", icon: IconPalette },
  { id: "canciones", label: "Canciones", icon: IconLibrary },
  { id: "miembros", label: "Miembros", icon: IconMembers }
];

const counts = computed<Partial<Record<Section, number>>>(() => ({
  canciones: collectionsStore.songs.length,
  miembros: members.value.length
}));

const sectionTo = (id: Section) => ({
  name: "collection-settings",
  params: { collectionSlug: collection.value?.slug, section: id === "general" ? "" : id }
});

function goBack() {
  if (window.history.state?.back) router.back();
  else if (collection.value) {
    router.push({ name: "collection", params: { collectionSlug: collection.value.slug } });
  } else router.push({ name: "home" });
}

// Keeps the store (and so the theme, the library and the player) in sync after a save.
function onCollectionUpdated(updated: Collection) {
  const index = collectionsStore.collections.findIndex((c) => c.id === updated.id);
  if (index === -1) return;
  const previous = collectionsStore.collections[index]!;
  collectionsStore.collections[index] = {
    ...previous,
    ...updated,
    user_role: previous.user_role,
    artwork_playback_url:
      updated.artwork_file_key === previous.artwork_file_key
        ? previous.artwork_playback_url
        : updated.artwork_playback_url
  };
  if (updated.slug !== previous.slug) {
    router.replace({
      name: "collection-settings",
      params: { collectionSlug: updated.slug, section: route.params.section ?? "" }
    });
  }
}

// The songs in the store belong to this collection (not a previous one still loading).
const songsLoaded = computed(
  () =>
    !!collection.value &&
    collectionsStore.songsCollectionId === collection.value.id &&
    !collectionsStore.isLoading
);

const userInitials = computed(() => initials(authStore.username ?? "?"));
</script>

<template>
  <div class="relative isolate flex h-dvh flex-col overflow-hidden">
    <RoomLight :collection="collection" />
    <LeaveDialog
      :open="guard.pending.value !== null"
      :summary="guard.summary.value"
      :can-save="guard.canSave.value"
      @choose="(choice) => guard.pending.value?.(choice)"
    />

    <LoadingScreen v-if="!ready || collectionsStore.isLoading" />

    <div
      v-else-if="!collection || !isAdmin"
      class="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center"
    >
      <IconLock class="size-16 opacity-40" />
      <h1 class="font-display text-2xl font-bold">No podés ver estos ajustes</h1>
      <p class="text-base-content/60 max-w-sm">
        Solo los admins de la colección.
      </p>
      <button class="btn btn-primary" @click="goBack">Volver</button>
    </div>

    <template v-else>
      <!-- top bar -->
      <header class="glass-1 rounded-box z-10 m-2 flex items-center gap-3 p-2 md:m-3">
        <button class="btn btn-ghost btn-sm hidden sm:inline-flex" @click="goBack">
          <IconBack class="size-4" /> Volver a la canción
        </button>
        <button class="btn btn-ghost btn-sm btn-square sm:hidden" aria-label="Volver" @click="goBack">
          <IconBack class="size-4" />
        </button>
        <div class="flex min-w-0 flex-col">
          <span class="font-display text-lg leading-tight font-bold">Ajustes</span>
          <span class="text-base-content/60 hidden truncate text-xs sm:block">{{
            collection.title
          }}</span>
        </div>
        <div class="flex-1" />
        <span
          class="bg-collection-soft text-collection-ink grid size-8 place-items-center rounded-full text-xs font-bold"
          >{{ userInitials }}</span
        >
      </header>

      <!-- phone: tabs -->
      <nav class="mx-2 mb-2 flex gap-1 overflow-x-auto md:hidden" aria-label="Secciones">
        <div class="bg-base-content/5 flex gap-0.5 rounded-full p-1">
          <RouterLink
            v-for="item in NAV"
            :key="item.id"
            :to="sectionTo(item.id)"
            replace
            class="rounded-full px-3 py-1.5 text-sm font-semibold whitespace-nowrap"
            :class="
              section === item.id ? 'bg-base-100 shadow-sm' : 'text-base-content/60'
            "
            >{{ item.label }}</RouterLink
          >
          <RouterLink
            :to="sectionTo('peligro')"
            replace
            class="rounded-full px-3 py-1.5 text-sm font-semibold whitespace-nowrap"
            :class="section === 'peligro' ? 'bg-base-100 text-error shadow-sm' : 'text-error/70'"
            >Peligro</RouterLink
          >
        </div>
      </nav>

      <div class="flex min-h-0 flex-1 gap-3 px-2 pb-2 md:px-3 md:pb-3">
        <!-- desktop: section nav -->
        <nav
          class="glass-2 rounded-box hidden w-56 shrink-0 flex-col gap-1 p-2 md:flex"
          aria-label="Secciones"
        >
          <RouterLink
            v-for="item in NAV"
            :key="item.id"
            :to="sectionTo(item.id)"
            replace
            class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collection-ink"
            :class="
              section === item.id
                ? 'bg-collection-soft text-collection-ink'
                : 'hover:bg-base-content/5 text-base-content/80'
            "
          >
            <component :is="item.icon" class="size-4.5" />
            <span class="flex-1">{{ item.label }}</span>
            <span v-if="counts[item.id]" class="text-base-content/50 text-xs font-medium">{{
              counts[item.id]
            }}</span>
          </RouterLink>
          <div class="border-base-content/10 my-1 border-t" />
          <RouterLink
            :to="sectionTo('peligro')"
            replace
            class="text-error flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collection-ink"
            :class="section === 'peligro' ? 'bg-error/10' : 'hover:bg-error/5'"
          >
            <IconWarning class="size-4.5" /> Zona de peligro
          </RouterLink>
          <div class="flex-1" />
        </nav>

        <main class="min-w-0 flex-1 overflow-y-auto" data-testid="settings-main">
          <SettingsGeneral
            v-if="section === 'general'"
            :key="`general-${collection.id}`"
            :collection="collection"
            @updated="onCollectionUpdated"
          />
          <SettingsColors
            v-else-if="section === 'pistas'"
            :key="`colors-${collection.id}`"
            :collection="collection"
            :songs="collectionsStore.songs"
            :songs-loaded="songsLoaded"
            @updated="onCollectionUpdated"
            @songs-changed="collectionsStore.fetchSongsByCollectionId(collection.id, { background: true })"
          />
          <SettingsSongs
            v-else-if="section === 'canciones'"
            :key="`songs-${collection.id}`"
            :collection="collection"
          />
          <SettingsMembers
            v-else-if="section === 'miembros'"
            :collection="collection"
            :members="members"
            :load-error="membersError"
            @refresh="loadMembers"
          />
          <SettingsDanger
            v-else
            :collection="collection"
            :song-count="collectionsStore.songs.length"
            :member-count="members.length"
          />
        </main>
      </div>
    </template>
  </div>
</template>
