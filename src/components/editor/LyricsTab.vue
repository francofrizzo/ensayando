<script setup lang="ts">
import { computed } from "vue";
import { toast } from "vue-sonner";

import { HelpCircle, Save } from "lucide-vue-next";

import SafeTeleport from "@/components/ui/SafeTeleport.vue";
import { useCurrentCollection } from "@/composables/useCurrentCollection";
import { useLyricsColoring } from "@/composables/useLyricsColoring";
import { useLyricsEditor, type FocusPosition } from "@/composables/useLyricsEditor";
import type { LyricVerse } from "@/data/types";
import { useAuthStore } from "@/stores/auth";
import { useCollectionsStore } from "@/stores/collections";
import KeyboardHelpModal from "./KeyboardHelpModal.vue";
import LyricsToolbar from "./LyricsToolbar.vue";

const store = useCollectionsStore();
const authStore = useAuthStore();
const { currentCollection } = useCurrentCollection();
const { getVerseStyles } = useLyricsColoring();
const { saveLyrics } = store;

const isSaveDisabled = computed(() => {
  return !authStore.isAuthenticated || !store.localLyrics.isDirty || store.localLyrics.isSaving;
});

const handleSaveClick = () => {
  try {
    saveLyrics();
  } catch (error) {
    toast.error(`Error al guardar letras: ${error}`);
  }
};

const lyricsToDisplay = computed(() => {
  const lyrics = store.localLyrics.value;
  if (lyrics.length === 0) {
    // Return a single stanza with one empty verse
    return [[{ text: "", start_time: undefined, end_time: undefined }]];
  }
  return lyrics;
});

const {
  showHelp,
  handleInputFocus,
  currentFocus,
  insertLine,
  deleteLine,
  duplicateLine,
  insertColumn,
  insertStanza,
  convertToColumns
} = useLyricsEditor(lyricsToDisplay, store.updateLocalLyrics, handleSaveClick);

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

const onInputFocus = (position: FocusPosition) => {
  handleInputFocus(position);
};

defineExpose({
  hasUnsavedChanges: computed(() => store.localLyrics.isDirty)
});
</script>

<template>
  <div class="h-full flex flex-col gap-2 pl-3 pr-2 min-w-0 overflow-y-auto">
    <div class="sticky top-0 z-10 flex justify-center">
      <LyricsToolbar
        :current-focus="currentFocus"
        :on-insert-stanza="insertStanza"
        :on-insert-line="insertLine"
        :on-duplicate-line="duplicateLine"
        :on-delete-line="deleteLine"
        :on-insert-column="insertColumn"
        :on-convert-to-columns="convertToColumns"
      />
    </div>
    <div class="flex-1 flex flex-col pb-3">
      <div
        v-for="(stanza, i) in lyricsToDisplay"
        :key="i"
        class="border-1 not-first:border-t-0 not-first:rounded-t-none not-last:rounded-b-none border-base-content/15 rounded-box py-4"
      >
        <div class="flex flex-col items-stretch gap-1">
          <template v-for="(item, j) in stanza" :key="`${i}-${j}`">
            <div
              v-if="!Array.isArray(item)"
              class="flex focus-within:bg-base-content/8 px-5 cursor-text"
              @click="($event.target as HTMLElement).querySelector('textarea')?.focus()"
            >
              <textarea
                v-model="createVerseModel(i, j).value"
                :data-input="`${i}-${j}`"
                :style="getVerseStyles(item, currentCollection)"
                rows="1"
                class="font-mono text-sm focus:outline-none focus:ring-0 focus:bg-base-content/15 rounded-sm px-1 resize-none overflow-hidden bg-size-content"
                style="field-sizing: content"
                @focus="onInputFocus({ stanzaIndex: i, itemIndex: j })"
                @keydown="
                  (e) => {
                    if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.altKey) {
                      e.preventDefault();
                    }
                  }
                "
                @input="
                  (e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = target.scrollHeight + 'px';
                  }
                "
              />
            </div>
            <div v-else class="flex flex-row w-full items-stretch">
              <div
                v-for="(column, k) in item"
                :key="`${i}-${j}-${k}`"
                class="flex-1 flex flex-col gap-1 justify-center not-last:border-r-1 border-base-content/20"
              >
                <div
                  v-for="(line, l) in column"
                  :key="`${i}-${j}-${k}-${l}`"
                  class="flex focus-within:bg-base-content/8 px-3 cursor-text"
                  :class="{ 'pl-5': k === 0, 'pr-5': k === column.length - 1 }"
                  @click="($event.target as HTMLElement).querySelector('textarea')?.focus()"
                >
                  <textarea
                    v-model="createColumnModel(i, j, k, l).value"
                    :data-input="`${i}-${j}-${k}-${l}`"
                    :style="getVerseStyles(line, currentCollection)"
                    rows="1"
                    class="font-mono text-sm focus:outline-none focus:ring-0 focus:bg-base-content/15 rounded-sm px-1 resize-none overflow-hidden"
                    style="field-sizing: content"
                    @focus="
                      onInputFocus({ stanzaIndex: i, itemIndex: j, columnIndex: k, lineIndex: l })
                    "
                    @keydown="
                      (e) => {
                        if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.altKey) {
                          e.preventDefault();
                        }
                      }
                    "
                    @input="
                      (e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = target.scrollHeight + 'px';
                      }
                    "
                  />
                </div>
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
