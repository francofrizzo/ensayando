<script setup lang="ts">
import {
  IconDownload,
  IconEdit,
  IconEnter,
  IconHome,
  IconLibrary,
  IconMusic,
  IconSearch,
  IconSettings,
  IconThemeDark,
  IconThemeLight,
  IconThemeSystem,
  IconUpDown
} from "@/components/ui/icons";
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useCollectionPalette } from "@/composables/useCollectionPalette";
import { useCurrentCollection } from "@/composables/useCurrentCollection";
import { useCurrentSong } from "@/composables/useCurrentSong";
import { useDialogFocus } from "@/composables/useDialogFocus";
import { useTheme } from "@/composables/useTheme";
import { useCollectionsStore } from "@/stores/collections";
import { useSongIndexStore } from "@/stores/songIndex";
import { useUIStore } from "@/stores/ui";
import { dispatchPlayerCommand } from "@/utils/appEvents";
import {
  buildCommandGroups,
  type CommandAction,
  type CommandItem,
  highlightMatch
} from "@/utils/navigation";

const uiStore = useUIStore();
const collectionsStore = useCollectionsStore();
const songIndex = useSongIndexStore();
const router = useRouter();
const route = useRoute();
const { currentCollection } = useCurrentCollection();
const { currentSong } = useCurrentSong();
const { mainColor } = useCollectionPalette(currentCollection);
const { setMode: setThemeMode } = useTheme();

const dialog = ref<HTMLElement | null>(null);
const input = ref<HTMLInputElement | null>(null);
const query = ref("");
const activeIndex = ref(0);

const open = computed(() => uiStore.commandPaletteOpen);
const close = () => uiStore.closeCommandPalette();

useDialogFocus({ open, container: dialog, initial: input, onClose: close });

watch(open, (isOpen) => {
  if (!isOpen) return;
  query.value = "";
  activeIndex.value = 0;
  void songIndex.ensureLoaded();
});

// ---------- actions available here ----------

type RunnableAction = CommandAction & { icon: typeof IconSearch; run: () => void };

const actions = computed<RunnableAction[]>(() => {
  const list: RunnableAction[] = [];
  const onSong = route.name === "song" && currentSong.value;
  if (onSong && collectionsStore.canEditCurrentCollection) {
    list.push({
      id: "edit-song",
      label: "Editar canción",
      hint: "E",
      icon: IconEdit,
      run: () => dispatchPlayerCommand("edit-song")
    });
  }
  if (onSong) {
    list.push({
      id: "download-mix",
      label: "Descargar mezcla",
      hint: "⌘⇧E",
      icon: IconDownload,
      run: () => dispatchPlayerCommand("download-mix")
    });
  }
  if (currentCollection.value?.user_role === "admin") {
    const slug = currentCollection.value.slug;
    list.push({
      id: "collection-settings",
      label: "Ajustes de la colección",
      icon: IconSettings,
      run: () => void router.push(`/${slug}/ajustes/general`)
    });
  }
  list.push(
    {
      id: "library",
      label: "Abrir la biblioteca",
      icon: IconLibrary,
      run: () => uiStore.openLibrary()
    },
    {
      id: "home",
      label: "Ir al inicio",
      icon: IconHome,
      run: () => void router.push({ name: "home" })
    },
    {
      id: "theme-system",
      label: "Tema del sistema",
      icon: IconThemeSystem,
      run: () => setThemeMode("system")
    },
    {
      id: "theme-light",
      label: "Tema claro",
      icon: IconThemeLight,
      run: () => setThemeMode("light")
    },
    { id: "theme-dark", label: "Tema oscuro", icon: IconThemeDark, run: () => setThemeMode("dark") }
  );
  return list;
});

const groups = computed(() =>
  buildCommandGroups(query.value, {
    songs: songIndex.songs,
    collections: collectionsStore.collections,
    actions: actions.value,
    currentCollectionId: currentCollection.value?.id ?? null
  })
);

const flatItems = computed(() => groups.value.flatMap((group) => group.items));

watch(query, () => (activeIndex.value = 0));

const itemIndex = (item: CommandItem) => flatItems.value.indexOf(item);

const iconFor = (item: CommandItem) => {
  if (item.kind === "song") return IconMusic;
  if (item.kind === "collection") return IconLibrary;
  return actions.value.find((action) => action.id === item.action.id)?.icon ?? IconSearch;
};

const run = (item: CommandItem | undefined) => {
  if (!item) return;
  close();
  if (item.kind === "song") {
    const collection = collectionsStore.collections.find((c) => c.id === item.song.collection_id);
    if (collection) {
      void router.push({
        name: "song",
        params: { collectionSlug: collection.slug, songSlug: item.song.slug }
      });
    }
  } else if (item.kind === "collection") {
    void router.push({ name: "collection", params: { collectionSlug: item.collection.slug } });
  } else {
    actions.value.find((action) => action.id === item.action.id)?.run();
  }
};

const onInputKeydown = (event: KeyboardEvent) => {
  const count = flatItems.value.length;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (count) activeIndex.value = (activeIndex.value + 1) % count;
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    if (count) activeIndex.value = (activeIndex.value - 1 + count) % count;
  } else if (event.key === "Enter") {
    event.preventDefault();
    run(flatItems.value[activeIndex.value]);
  }
};

// Keep the active option in view while moving with the keyboard.
watch(activeIndex, (index) => {
  dialog.value?.querySelector(`#command-option-${index}`)?.scrollIntoView({ block: "nearest" });
});

const accent = computed(() => ({ ink: mainColor("ink"), soft: mainColor("soft") }));
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-150 ease-out"
    leave-active-class="transition-opacity duration-100 ease-in"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div v-if="open" class="fixed inset-0 z-[60]">
      <div class="bg-base-300/30 absolute inset-0 backdrop-blur-[3px]" @click="close" />
      <div
        ref="dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Buscar"
        data-testid="command-palette"
        class="glass-3 text-base-content absolute inset-x-3 top-[max(12px,env(safe-area-inset-top))] mx-auto flex max-h-[min(560px,80dvh)] max-w-[620px] [animation:empty-stagger_200ms_ease-out_both] flex-col overflow-hidden rounded-[20px] sm:top-[14vh]"
      >
        <div
          class="border-base-content/10 flex shrink-0 items-center gap-3 border-b px-[18px] py-4"
        >
          <IconSearch class="text-base-content/45 size-5 shrink-0" />
          <input
            ref="input"
            v-model="query"
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="command-results"
            :aria-expanded="flatItems.length > 0"
            :aria-activedescendant="flatItems.length ? `command-option-${activeIndex}` : undefined"
            placeholder="Buscar canciones, colecciones o acciones"
            class="placeholder:text-base-content/40 min-w-0 flex-1 bg-transparent text-lg outline-none"
            autocomplete="off"
            spellcheck="false"
            @keydown="onInputKeydown"
          />
        </div>

        <div
          id="command-results"
          role="listbox"
          class="min-h-0 flex-1 overflow-y-auto px-2 pt-1.5 pb-2"
        >
          <template v-for="group in groups" :key="group.id">
            <div
              class="text-base-content/45 px-2.5 pt-2.5 pb-1.5 text-[11px] font-semibold tracking-[0.1em] uppercase"
              role="presentation"
            >
              {{ group.label }}
            </div>
            <div
              v-for="item in group.items"
              :id="`command-option-${itemIndex(item)}`"
              :key="item.key"
              role="option"
              :aria-selected="itemIndex(item) === activeIndex"
              class="flex cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 py-[9px] text-sm"
              :style="
                itemIndex(item) === activeIndex
                  ? { background: accent.soft, color: accent.ink }
                  : {}
              "
              @mousemove="activeIndex = itemIndex(item)"
              @click="run(item)"
            >
              <component
                :is="iconFor(item)"
                class="size-[17px] shrink-0"
                :class="itemIndex(item) === activeIndex ? '' : 'text-base-content/50'"
              />
              <span class="min-w-0 truncate">
                <template v-for="(segment, i) in highlightMatch(item.label, query)" :key="i">
                  <mark
                    v-if="segment.match"
                    class="bg-transparent font-bold"
                    :style="{ color: accent.ink }"
                    >{{ segment.text }}</mark
                  ><template v-else>{{ segment.text }}</template>
                </template>
              </span>
              <span
                v-if="item.kind === 'song'"
                class="text-base-content/45 ml-auto shrink-0 truncate pl-2 text-xs"
                >{{ item.detail }}</span
              >
              <kbd
                v-else-if="item.kind === 'action' && item.hint"
                class="kbd kbd-xs ml-auto shrink-0"
                >{{ item.hint }}</kbd
              >
            </div>
          </template>
          <p v-if="groups.length === 0" class="text-base-content/60 px-2.5 py-4 text-sm">
            Nada coincide con “{{ query }}”.
          </p>
        </div>

        <div
          class="border-base-content/10 text-base-content/45 flex shrink-0 gap-4 border-t px-4 py-2.5 text-xs max-sm:hidden"
        >
          <span class="flex items-center gap-1.5"><IconUpDown class="size-3.5" /> Moverse</span>
          <span class="flex items-center gap-1.5"><IconEnter class="size-3.5" /> Abrir</span>
          <span class="flex items-center gap-1.5"><kbd class="kbd kbd-xs">esc</kbd> Cerrar</span>
        </div>
      </div>
    </div>
  </Transition>
</template>
