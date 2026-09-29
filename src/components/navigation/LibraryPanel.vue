<script setup lang="ts">
import {
  IconClose,
  IconGlobe,
  IconLink,
  IconLock,
  IconLogIn,
  IconLogOut,
  IconNoLyrics,
  IconPlus,
  IconSearch,
  IconSettings,
  IconThemeDark,
  IconThemeLight,
  IconThemeSystem
} from "@/components/ui/icons";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";

import PlayingBars from "@/components/ui/PlayingBars.vue";
import { useCollectionPalette } from "@/composables/useCollectionPalette";
import { useCurrentCollection } from "@/composables/useCurrentCollection";
import { useCurrentSong } from "@/composables/useCurrentSong";
import { useDialogFocus } from "@/composables/useDialogFocus";
import { type ThemeMode, useTheme } from "@/composables/useTheme";
import type { CollectionVisibility, CollectionWithRole, Song } from "@/data/types";
import { useAuthStore } from "@/stores/auth";
import { useCollectionsStore } from "@/stores/collections";
import { useSongIndexStore } from "@/stores/songIndex";
import { useUIStore } from "@/stores/ui";
import { dispatchPlayerCommand, onPlayback } from "@/utils/appEvents";
import {
  filterSongs,
  formatDuration,
  ROLE_LABELS,
  songCountLabel,
  songDuration,
  totalDuration,
  VISIBILITY_LABELS
} from "@/utils/navigation";

const uiStore = useUIStore();
const collectionsStore = useCollectionsStore();
const authStore = useAuthStore();
const songIndex = useSongIndexStore();
const router = useRouter();
const route = useRoute();
const { currentCollection } = useCurrentCollection();
const { currentSong } = useCurrentSong();
const { mainColor } = useCollectionPalette(currentCollection);
const { mode: themeMode, setMode: setThemeMode } = useTheme();

const panel = ref<HTMLElement | null>(null);
const query = ref("");

const open = computed(() => uiStore.libraryOpen);
const close = () => uiStore.closeLibrary();

// Focus goes to the panel itself: focusing the search field would open the
// keyboard on phones and hide half the list.
useDialogFocus({ open, container: panel, initial: panel, onClose: close });

watch(open, (isOpen) => {
  if (!isOpen) return;
  query.value = "";
  void songIndex.ensureLoaded();
});

// Following a link closes the panel.
watch(
  () => route.fullPath,
  () => close()
);

const playing = ref(false);
let stopListening: (() => void) | null = null;
onMounted(() => (stopListening = onPlayback((value) => (playing.value = value))));
onUnmounted(() => stopListening?.());

// ---------- current collection ----------

const allSongs = computed(() =>
  currentCollection.value && collectionsStore.songsCollectionId === currentCollection.value.id
    ? collectionsStore.songs
    : []
);
const filteredSongs = computed(() => filterSongs(allSongs.value, query.value));
const songNumber = (song: Song) => allSongs.value.indexOf(song) + 1;
const summary = computed(() => {
  const count = songCountLabel(allSongs.value.length);
  const total = totalDuration(allSongs.value);
  return total ? `${count} · ${total}` : count;
});

const canEdit = computed(() => collectionsStore.canEditCurrentCollection);
const isAdmin = computed(() => currentCollection.value?.user_role === "admin");

const accent = computed(() => ({ ink: mainColor("ink"), soft: mainColor("soft") }));

const visibilityIcon: Record<CollectionVisibility, typeof IconGlobe> = {
  public: IconGlobe,
  unlisted: IconLink,
  private: IconLock
};

const hasLyrics = (song: Song) => (song.lyrics?.length ?? 0) > 0;

const songRoute = (collection: CollectionWithRole, song: Pick<Song, "slug">) => ({
  name: "song",
  params: { collectionSlug: collection.slug, songSlug: song.slug }
});

// ---------- other collections ----------

const otherCollections = computed(() =>
  collectionsStore.collections.filter((collection) => collection.id !== currentCollection.value?.id)
);
const songCount = (collection: CollectionWithRole) =>
  songIndex.countByCollection.get(collection.id);

// ---------- actions ----------

const openSettings = () => {
  if (!currentCollection.value) return;
  close();
  void router.push(`/${currentCollection.value.slug}/ajustes/general`);
};

// Until the new song flow lands, "Nueva canción" opens today's editor in create mode.
const createSong = () => {
  close();
  if (route.name === "song") {
    uiStore.setEditMode(true);
    dispatchPlayerCommand("new-song");
  } else if (currentCollection.value) {
    void router.push({
      name: "collection",
      params: { collectionSlug: currentCollection.value.slug }
    });
  }
};

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: typeof IconThemeSystem }[] = [
  { mode: "system", label: "Tema del sistema", icon: IconThemeSystem },
  { mode: "light", label: "Tema claro", icon: IconThemeLight },
  { mode: "dark", label: "Tema oscuro", icon: IconThemeDark }
];

const initials = computed(() => (authStore.username ?? "").slice(0, 2).toUpperCase() || "?");

const signOut = async () => {
  try {
    await authStore.signOut();
    close();
    await router.replace({ name: "login", query: { redirect: route.fullPath } });
  } catch (error) {
    toast.error(`No se pudo cerrar la sesión: ${error}`);
  }
};

const signIn = () => {
  close();
  void router.push({ name: "login", query: { redirect: route.fullPath } });
};
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-200 ease-out"
    leave-active-class="transition-opacity duration-150 ease-in"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div v-if="open" class="fixed inset-0 z-50">
      <div class="bg-base-300/30 absolute inset-0 backdrop-blur-[3px]" @click="close" />

      <aside
        ref="panel"
        role="dialog"
        aria-modal="true"
        aria-label="Biblioteca"
        data-testid="library-panel"
        tabindex="-1"
        class="glass-2 text-base-content absolute inset-x-1.5 top-12 bottom-1.5 flex flex-col overflow-hidden rounded-[34px] outline-none max-sm:[animation:empty-stagger_260ms_ease-out_both] sm:inset-x-auto sm:top-3 sm:bottom-3 sm:left-3 sm:w-[384px] sm:[animation:menu-item-slide_220ms_ease-out_both] sm:rounded-[22px]"
        style="padding-bottom: env(safe-area-inset-bottom, 0px)"
      >
        <span
          class="bg-base-content/20 mx-auto mt-2 h-[5px] w-[38px] shrink-0 rounded-full sm:hidden"
        />

        <!-- Current collection -->
        <template v-if="currentCollection">
          <header class="flex shrink-0 flex-col gap-3.5 px-[18px] pt-3 pb-3 sm:pt-[18px]">
            <div class="flex items-start gap-3">
              <div class="min-w-0 flex-1">
                <h2
                  class="font-display text-[22px] leading-[1.05] font-bold text-balance sm:text-2xl"
                >
                  {{ currentCollection.title }}
                </h2>
                <p class="text-base-content/60 mt-1.5 text-xs font-medium">{{ summary }}</p>
                <div class="mt-2.5 flex flex-wrap gap-1.5">
                  <span
                    class="badge badge-sm bg-base-content/7 text-base-content/70 gap-1 border-0"
                  >
                    <component :is="visibilityIcon[currentCollection.visibility]" class="size-3" />
                    {{ VISIBILITY_LABELS[currentCollection.visibility] }}
                  </span>
                  <span
                    class="badge badge-sm border-0"
                    :style="{ background: accent.soft, color: accent.ink }"
                    >{{ ROLE_LABELS[currentCollection.user_role] }}</span
                  >
                </div>
              </div>
              <div class="-mt-1 -mr-1 flex gap-0.5">
                <button
                  v-if="isAdmin"
                  type="button"
                  class="btn btn-circle btn-ghost btn-sm"
                  aria-label="Ajustes de la colección"
                  title="Ajustes de la colección"
                  @click="openSettings"
                >
                  <IconSettings class="size-[18px]" />
                </button>
                <button
                  type="button"
                  class="btn btn-circle btn-ghost btn-sm"
                  aria-label="Cerrar biblioteca"
                  @click="close"
                >
                  <IconClose class="size-[18px]" />
                </button>
              </div>
            </div>
            <label v-if="allSongs.length > 0" class="input input-sm w-full rounded-full">
              <IconSearch class="size-4 opacity-50" />
              <input
                v-model="query"
                type="search"
                placeholder="Buscar en la colección"
                aria-label="Buscar canción"
              />
            </label>
          </header>

          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <ul v-if="filteredSongs.length > 0" class="flex flex-col gap-px px-2.5 py-1">
              <li v-for="song in filteredSongs" :key="song.id">
                <RouterLink
                  :to="songRoute(currentCollection, song)"
                  class="grid grid-cols-[26px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[11px] px-2.5 py-2.5 text-[15px] font-medium sm:py-[9px] sm:text-[14.5px]"
                  :class="currentSong?.id === song.id ? 'font-semibold' : 'hover:bg-base-content/5'"
                  :style="
                    currentSong?.id === song.id
                      ? { background: accent.soft, color: accent.ink }
                      : {}
                  "
                  :aria-current="currentSong?.id === song.id ? 'page' : undefined"
                >
                  <span
                    class="flex justify-end font-mono text-xs tabular-nums"
                    :class="currentSong?.id === song.id ? '' : 'text-base-content/45'"
                  >
                    <PlayingBars v-if="currentSong?.id === song.id" :playing="playing" />
                    <template v-else>{{ songNumber(song) }}</template>
                  </span>
                  <span class="flex min-w-0 items-center gap-[7px]">
                    <IconLock
                      v-if="!song.visible"
                      class="text-base-content/45 size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span class="truncate" :class="{ 'text-base-content/60': !song.visible }">{{
                      song.title
                    }}</span>
                    <span
                      v-if="!song.visible"
                      class="badge badge-xs bg-base-content/7 text-base-content/60 shrink-0 border-0"
                      >Oculta</span
                    >
                    <IconNoLyrics
                      v-if="!hasLyrics(song)"
                      class="text-base-content/35 size-3.5 shrink-0"
                      aria-label="Sin letra"
                      role="img"
                    />
                  </span>
                  <span
                    class="font-mono text-xs tabular-nums"
                    :class="currentSong?.id === song.id ? '' : 'text-base-content/45'"
                  >
                    <template v-if="songDuration(song) !== null">{{
                      formatDuration(songDuration(song)!)
                    }}</template>
                  </span>
                </RouterLink>
              </li>
            </ul>
            <p v-else-if="query" class="text-base-content/60 px-5 py-4 text-sm">
              Ninguna canción coincide con “{{ query }}”.
            </p>
            <p v-else class="text-base-content/60 px-5 py-4 text-sm">
              Esta colección todavía no tiene canciones.
            </p>

            <div v-if="canEdit" class="px-2.5 pb-1">
              <button
                type="button"
                class="btn btn-ghost btn-sm w-full justify-start gap-2.5 rounded-[11px] font-medium"
                :style="{ color: accent.ink }"
                @click="createSong"
              >
                <IconPlus class="size-4" /> Nueva canción
              </button>
            </div>

            <template v-if="otherCollections.length > 0">
              <h3
                class="text-base-content/45 px-5 pt-4 pb-2 text-[11px] font-semibold tracking-[0.1em] uppercase"
              >
                Otras colecciones
              </h3>
              <ul class="flex flex-col gap-px px-2.5 pb-2">
                <li v-for="collection in otherCollections" :key="collection.id">
                  <RouterLink
                    :to="{ name: 'collection', params: { collectionSlug: collection.slug } }"
                    class="hover:bg-base-content/5 flex items-center gap-2.5 rounded-[11px] px-2.5 py-[7px] text-sm font-medium"
                  >
                    <span class="truncate">{{ collection.title }}</span>
                    <component
                      :is="visibilityIcon[collection.visibility]"
                      class="text-base-content/45 size-3.5 shrink-0"
                      :aria-label="VISIBILITY_LABELS[collection.visibility]"
                      role="img"
                    />
                    <small
                      v-if="songCount(collection) !== undefined"
                      class="text-base-content/45 ml-auto shrink-0 text-xs"
                      >{{ songCount(collection) }}</small
                    >
                  </RouterLink>
                </li>
              </ul>
            </template>
          </div>
        </template>

        <!-- No collection in view (home, errors): just the collections -->
        <template v-else>
          <header
            class="flex shrink-0 items-center justify-between px-[18px] pt-3 pb-2 sm:pt-[18px]"
          >
            <h2 class="font-display text-[22px] font-bold">Colecciones</h2>
            <button
              type="button"
              class="btn btn-circle btn-ghost btn-sm -mr-1"
              aria-label="Cerrar biblioteca"
              @click="close"
            >
              <IconClose class="size-[18px]" />
            </button>
          </header>
          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <ul class="flex flex-col gap-px px-2.5 pb-2">
              <li v-for="collection in collectionsStore.collections" :key="collection.id">
                <RouterLink
                  :to="{ name: 'collection', params: { collectionSlug: collection.slug } }"
                  class="hover:bg-base-content/5 flex items-center gap-2.5 rounded-[11px] px-2.5 py-2 text-sm font-medium"
                >
                  <span class="truncate">{{ collection.title }}</span>
                  <component
                    :is="visibilityIcon[collection.visibility]"
                    class="text-base-content/45 size-3.5 shrink-0"
                    :aria-label="VISIBILITY_LABELS[collection.visibility]"
                    role="img"
                  />
                  <small
                    v-if="songCount(collection) !== undefined"
                    class="text-base-content/45 ml-auto shrink-0 text-xs"
                    >{{ songCount(collection) }}</small
                  >
                </RouterLink>
              </li>
            </ul>
            <p
              v-if="collectionsStore.collections.length === 0"
              class="text-base-content/60 px-5 py-2 text-sm"
            >
              No hay colecciones disponibles.
            </p>
          </div>
        </template>

        <!-- Account and theme -->
        <footer
          class="border-base-content/10 flex shrink-0 items-center gap-2.5 border-t px-3.5 py-2.5"
        >
          <template v-if="authStore.isAuthenticated">
            <span
              class="grid size-[30px] shrink-0 place-items-center rounded-full text-xs font-bold"
              :style="{ background: accent.soft, color: accent.ink }"
              aria-hidden="true"
              >{{ initials }}</span
            >
            <span class="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{{
              authStore.username
            }}</span>
          </template>
          <span v-else class="text-base-content/60 flex-1 text-[13.5px]">Sin sesión</span>

          <div class="join" role="group" aria-label="Tema">
            <button
              v-for="option in THEME_OPTIONS"
              :key="option.mode"
              type="button"
              class="btn btn-xs btn-square join-item"
              :class="themeMode === option.mode ? 'btn-active' : 'btn-ghost'"
              :aria-label="option.label"
              :aria-pressed="themeMode === option.mode"
              :title="option.label"
              @click="setThemeMode(option.mode)"
            >
              <component :is="option.icon" class="size-3.5" />
            </button>
          </div>

          <button
            v-if="authStore.isAuthenticated"
            type="button"
            class="btn btn-circle btn-ghost btn-sm"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            @click="signOut"
          >
            <IconLogOut class="size-4" />
          </button>
          <button v-else type="button" class="btn btn-sm btn-ghost gap-1.5" @click="signIn">
            <IconLogIn class="size-4" /> Entrar
          </button>
        </footer>
      </aside>
    </div>
  </Transition>
</template>
