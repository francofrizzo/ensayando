<script setup lang="ts">
import { computed } from "vue";

import AccountMenu from "@/components/player/AccountMenu.vue";
import SongActionsMenu from "@/components/player/SongActionsMenu.vue";
import { IconEdit, IconLibrary, IconSearch, IconSelector } from "@/components/ui/icons";
import { artworkPlaybackUrl } from "@/data/storage";
import type { CollectionWithRole, Song } from "@/data/types";

const props = defineProps<{
  collection: CollectionWithRole;
  song: Song;
  songCount: number;
  canEdit: boolean;
  isAdmin: boolean;
  editMode: boolean;
  exporting: boolean;
  canDownload: boolean;
}>();

const emit = defineEmits<{
  library: [];
  search: [];
  edit: [];
  download: [];
  shortcuts: [];
  settings: [];
}>();

const artwork = computed(() =>
  props.collection.artwork_file_url ? artworkPlaybackUrl(props.collection) : undefined
);
</script>

<template>
  <header class="glass-1 relative flex h-14 items-center gap-2 rounded-[18px] px-1.5 md:h-[60px] md:gap-3 md:px-2.5">
    <!-- Library: collection name (and cover, only when there is one) -->
    <button
      class="hover:bg-base-content/6 flex min-w-0 shrink-0 items-center gap-2.5 rounded-[14px] py-1 pr-1 pl-1 text-left transition-colors md:pr-3"
      aria-label="Abrir la biblioteca"
      data-testid="library-button"
      @click="emit('library')"
    >
      <img
        v-if="artwork"
        :src="artwork"
        alt=""
        class="size-10 shrink-0 rounded-[10px] object-cover"
      />
      <span
        v-else
        class="bg-base-content/7 grid size-9 shrink-0 place-items-center rounded-full md:size-10"
      >
        <IconLibrary class="size-[18px]" />
      </span>
      <span class="hidden min-w-0 flex-col gap-1 md:flex">
        <span class="flex items-center gap-1 text-sm leading-none font-semibold">
          <span class="max-w-52 truncate">{{ props.collection.title }}</span>
          <IconSelector class="text-base-content/40 size-3.5 shrink-0" />
        </span>
        <span class="text-base-content/60 text-xs leading-none">
          {{ props.songCount }} {{ props.songCount === 1 ? "canción" : "canciones" }}
        </span>
      </span>
    </button>

    <!-- Song title: centered on desktop, inline on phone -->
    <Transition name="song-change" mode="out-in">
      <h1
        :key="props.song.id"
        data-testid="song-title"
        class="font-display min-w-0 flex-1 truncate text-[17px] leading-tight font-bold md:pointer-events-none md:absolute md:inset-x-0 md:mx-auto md:max-w-[34%] md:text-center md:text-[21px]"
      >
        {{ props.song.title }}
      </h1>
    </Transition>

    <div class="ml-auto flex shrink-0 items-center gap-1 md:gap-1.5">
      <button
        v-if="props.canEdit"
        class="btn btn-sm bg-base-content/7 hover:bg-base-content/12 hidden gap-1.5 rounded-full border-0 font-semibold shadow-none md:inline-flex"
        :class="{ 'btn-active': props.editMode }"
        data-testid="edit-button"
        @click="emit('edit')"
      >
        <IconEdit class="size-4" />
        Editar
      </button>
      <button
        class="btn btn-sm btn-circle btn-ghost hidden md:inline-flex"
        aria-label="Buscar"
        title="Buscar (⌘K)"
        @click="emit('search')"
      >
        <IconSearch class="size-[18px]" />
      </button>
      <SongActionsMenu
        :can-edit="props.canEdit"
        :is-admin="props.isAdmin"
        :exporting="props.exporting"
        :can-download="props.canDownload"
        @download="emit('download')"
        @edit="emit('edit')"
        @shortcuts="emit('shortcuts')"
        @settings="emit('settings')"
      />
      <AccountMenu class="hidden md:block" />
    </div>
  </header>
</template>
