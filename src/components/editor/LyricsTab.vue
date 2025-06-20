<script setup lang="ts">
import { HelpCircle, Save } from "lucide-vue-next";
import { computed } from "vue";
import { toast } from "vue-sonner";

import SafeTeleport from "@/components/ui/SafeTeleport.vue";
import {
  useKeyboardLyricsNavigation,
  type FocusPosition
} from "@/composables/useKeyboardLyricsNavigation";
import type { LyricVerse } from "@/data/types";
import { useAuthStore } from "@/stores/auth";
import { useCollectionsStore } from "@/stores/collections";
import KeyboardHelpModal from "./KeyboardHelpModal.vue";

const store = useCollectionsStore();
const authStore = useAuthStore();
const { saveLyrics } = store;

// Computed property for save button state
const isSaveDisabled = computed(() => {
  return !authStore.isAuthenticated || !store.localLyrics.isDirty || store.localLyrics.isSaving;
});

// Save handler
const handleSaveClick = () => {
  try {
    saveLyrics();
  } catch (error) {
    toast.error(`Error al guardar letras: ${error}`);
  }
};

// Computed property to ensure we always have at least one stanza with one verse
const lyricsToDisplay = computed(() => {
  const lyrics = store.localLyrics.value;
  if (lyrics.length === 0) {
    // Return a single stanza with one empty verse
    return [[{ text: "", start_time: undefined, end_time: undefined }]];
  }
  return lyrics;
});

// Initialize keyboard navigation
const { showHelp, handleInputFocus } = useKeyboardLyricsNavigation(
  lyricsToDisplay,
  store.updateLocalLyrics,
  handleSaveClick
);

// Create computed properties for two-way binding
const createVerseModel = (stanzaIndex: number, itemIndex: number) => {
  return computed({
    get: (): string => {
      const stanza = store.localLyrics.value[stanzaIndex];
      if (stanza && !Array.isArray(stanza[itemIndex])) {
        return (stanza[itemIndex] as LyricVerse).text;
      }
      return "";
    },
    set: (newText: string) => {
      let currentLyrics = [...store.localLyrics.value];

      // If lyrics are empty, initialize with the default structure
      if (currentLyrics.length === 0) {
        currentLyrics = [[{ text: "", start_time: undefined, end_time: undefined }]];
      }

      const stanza = currentLyrics[stanzaIndex];
      if (stanza && !Array.isArray(stanza[itemIndex])) {
        (stanza[itemIndex] as LyricVerse).text = newText;
        store.updateLocalLyrics(currentLyrics);
      }
    }
  });
};

const createColumnModel = (
  stanzaIndex: number,
  itemIndex: number,
  columnIndex: number,
  lineIndex: number
) => {
  return computed({
    get: (): string => {
      const stanza = store.localLyrics.value[stanzaIndex];
      if (stanza && Array.isArray(stanza[itemIndex])) {
        const columns = stanza[itemIndex] as LyricVerse[][];
        if (columns[columnIndex] && columns[columnIndex][lineIndex]) {
          return columns[columnIndex][lineIndex].text;
        }
      }
      return "";
    },
    set: (newText: string) => {
      let currentLyrics = [...store.localLyrics.value];

      // If lyrics are empty, initialize with the default structure
      if (currentLyrics.length === 0) {
        currentLyrics = [[{ text: "", start_time: undefined, end_time: undefined }]];
      }

      const stanza = currentLyrics[stanzaIndex];
      if (stanza && Array.isArray(stanza[itemIndex])) {
        const columns = stanza[itemIndex] as LyricVerse[][];
        if (columns[columnIndex] && columns[columnIndex][lineIndex]) {
          columns[columnIndex][lineIndex].text = newText;
          store.updateLocalLyrics(currentLyrics);
        }
      }
    }
  });
};

// Focus handler for inputs
const onInputFocus = (position: FocusPosition) => {
  handleInputFocus(position);
};

// Expose hasUnsavedChanges to parent component
defineExpose({
  hasUnsavedChanges: computed(() => store.localLyrics.isDirty)
});
</script>

<template>
  <div class="h-full flex flex-col pl-3 pr-2 min-w-0">
    <div class="flex-1 flex flex-col pt-2 pb-3">
      <div
        v-for="(stanza, i) in lyricsToDisplay"
        :key="i"
        class="border-1 not-first:border-t-0 not-first:rounded-t-none not-last:rounded-b-none border-base-content/15 rounded-box px-5 py-4"
      >
        <div class="flex flex-col gap-1 items-start">
          <template v-for="(item, j) in stanza" :key="`${i}-${j}`">
            <input
              v-if="!Array.isArray(item)"
              v-model="createVerseModel(i, j).value"
              :data-input="`${i}-${j}`"
              type="text"
              class="grow w-full font-mono text-sm focus:outline-none focus:ring-0 focus:bg-base-content/15 rounded-sm px-1"
              @focus="onInputFocus({ stanzaIndex: i, itemIndex: j })"
            />
            <div v-else class="flex flex-row w-full gap-4 items-stretch">
              <div
                v-for="(column, k) in item"
                :key="`${i}-${j}-${k}`"
                class="flex-1 flex flex-col gap-1 items-start not-last:border-r-1 border-base-content/20"
              >
                <input
                  v-for="(line, l) in column"
                  :key="`${i}-${j}-${k}-${l}`"
                  v-model="createColumnModel(i, j, k, l).value"
                  :data-input="`${i}-${j}-${k}-${l}`"
                  type="text"
                  class="grow w-full font-mono text-sm focus:outline-none focus:ring-0 focus:bg-base-content/15 rounded-sm px-1"
                  @focus="
                    onInputFocus({ stanzaIndex: i, itemIndex: j, columnIndex: k, lineIndex: l })
                  "
                />
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <SafeTeleport to="[data-song-editor-actions]">
      <button
        class="btn btn-xs btn-ghost"
        title="Keyboard shortcuts (Shift + ?)"
        @click="showHelp = !showHelp"
      >
        <HelpCircle class="size-3.5" />
        <span class="hidden md:block">Ayuda</span>
      </button>

      <button class="btn btn-xs btn-primary" :disabled="isSaveDisabled" @click="handleSaveClick">
        <template v-if="store.localLyrics.isSaving">
          <span class="loading loading-spinner loading-xs" />
          <span>Guardando...</span>
        </template>

        <template v-else>
          <Save class="size-3.5" />
          <span class="hidden md:block">Guardar cambios</span>
        </template>
      </button>
    </SafeTeleport>

    <KeyboardHelpModal :show="showHelp" @close="showHelp = false" />
  </div>
</template>
