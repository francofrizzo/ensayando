<script setup lang="ts">
import { computed, ref } from "vue";
import { toast } from "vue-sonner";

import { HelpCircle, Save } from "lucide-vue-next";

import SafeTeleport from "@/components/ui/SafeTeleport.vue";
import { useCurrentCollection } from "@/composables/useCurrentCollection";
import { usePlayerState } from "@/composables/useCurrentTime";
import { useLyricsColoring } from "@/composables/useLyricsColoring";
import { useLyricsEditor, type FocusPosition } from "@/composables/useLyricsEditor";
import type { LyricVerse } from "@/data/types";
import { useAuthStore } from "@/stores/auth";
import { useCollectionsStore } from "@/stores/collections";
import KeyboardHelpModal from "./KeyboardHelpModal.vue";
import LyricsTextarea from "./LyricsTextarea.vue";
import LyricsToolbar from "./LyricsToolbar.vue";

const store = useCollectionsStore();
const authStore = useAuthStore();
const { currentCollection } = useCurrentCollection();
const { currentTime, isPlaying } = usePlayerState();
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
  convertToColumns,
  getCurrentVerseColors,
  setCurrentVerseColors,
  copyColorFromMode,
  toggleCopyColorFromMode,
  copyColorsFromVerse,
  setCurrentVerseStartTime,
  setCurrentVerseEndTime,
  adjustCurrentVerseStartTime,
  adjustCurrentVerseEndTime,
  clearCurrentVerseStartTime,
  clearCurrentVerseEndTime,
  clearCurrentVerseBothTimes
} = useLyricsEditor(
  lyricsToDisplay,
  store.updateLocalLyrics,
  handleSaveClick,
  () => currentTime.value
);

// Timestamp visibility state
const showTimestamps = ref(true);

const toggleTimestamps = () => {
  showTimestamps.value = !showTimestamps.value;
};

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

// Color functionality
const currentVerseColors = computed(() => getCurrentVerseColors());

const availableColors = computed(() =>
  Object.entries(currentCollection.value?.track_colors ?? {}).map(([key, value]) => ({
    key,
    value
  }))
);

const handleColorsChange = (colors: string[]) => {
  setCurrentVerseColors(colors);
};

const handleToggleCopyColorFrom = () => {
  toggleCopyColorFromMode();
};

const focusTextareaAndMoveCursorToEnd = (event: Event) => {
  const textarea = (event.target as HTMLElement).querySelector("textarea");
  if (textarea) {
    textarea.focus();
    // Move cursor to end
    const length = textarea.value.length;
    textarea.setSelectionRange(length, length);
  }
};

defineExpose({
  hasUnsavedChanges: computed(() => store.localLyrics.isDirty)
});
</script>

<template>
  <div class="h-full flex flex-col gap-2 pl-3 pr-2 min-w-0 overflow-y-auto">
    <div class="sticky top-0 z-10 flex flex-col items-center gap-2">
      <LyricsToolbar
        :current-focus="currentFocus"
        :on-insert-stanza="insertStanza"
        :on-insert-line="insertLine"
        :on-duplicate-line="duplicateLine"
        :on-delete-line="deleteLine"
        :on-insert-column="insertColumn"
        :on-convert-to-columns="convertToColumns"
        :current-verse-colors="currentVerseColors"
        :available-colors="availableColors"
        :copy-color-from-mode="copyColorFromMode"
        :on-colors-change="handleColorsChange"
        :on-toggle-copy-color-from="handleToggleCopyColorFrom"
        :show-timestamps="showTimestamps"
        :on-toggle-timestamps="toggleTimestamps"
        :on-set-start-time="setCurrentVerseStartTime"
        :on-set-end-time="setCurrentVerseEndTime"
        :on-adjust-start-time="adjustCurrentVerseStartTime"
        :on-adjust-end-time="adjustCurrentVerseEndTime"
        :on-clear-both-times="clearCurrentVerseBothTimes"
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
              class="flex flex-col items-start focus-within:bg-base-content/8 px-5"
              :class="{
                'cursor-text': !copyColorFromMode,
                'cursor-pointer bg-base-content/5 hover:bg-base-content/10': copyColorFromMode
              }"
              @click="
                copyColorFromMode
                  ? copyColorsFromVerse({ stanzaIndex: i, itemIndex: j })
                  : focusTextareaAndMoveCursorToEnd($event)
              "
            >
              <div
                v-if="
                  (item.start_time !== undefined || item.end_time !== undefined) && showTimestamps
                "
                class="flex flex-row gap-1 text-xs text-base-content/40 font-mono mr-3 px-1"
              >
                <span v-if="item.start_time !== undefined">
                  {{ item.start_time }}
                </span>
                <span v-if="item.end_time !== undefined">-</span>
                <span v-if="item.end_time !== undefined">
                  {{ item.end_time }}
                </span>
              </div>
              <LyricsTextarea
                v-model="createVerseModel(i, j).value"
                :data-input="`${i}-${j}`"
                :verse-styles="getVerseStyles(item, currentCollection)"
                :readonly="copyColorFromMode"
                :class="{ 'cursor-pointer': copyColorFromMode }"
                @focus="onInputFocus({ stanzaIndex: i, itemIndex: j })"
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
                  class="flex flex-col items-start focus-within:bg-base-content/8 px-3"
                  :class="{
                    'pl-5': k === 0,
                    'pr-5': k === column.length - 1,
                    'cursor-text': !copyColorFromMode,
                    'cursor-pointer bg-base-content/5 hover:bg-base-content/10': copyColorFromMode
                  }"
                  @click="
                    copyColorFromMode
                      ? copyColorsFromVerse({
                          stanzaIndex: i,
                          itemIndex: j,
                          columnIndex: k,
                          lineIndex: l
                        })
                      : focusTextareaAndMoveCursorToEnd($event)
                  "
                >
                  <div
                    v-if="
                      (line.start_time !== undefined || line.end_time !== undefined) &&
                      showTimestamps
                    "
                    class="flex flex-row gap-1 text-xs text-base-content/40 font-mono mr-3 px-1"
                  >
                    <span v-if="line.start_time !== undefined">
                      {{ line.start_time }}
                    </span>
                    <span v-if="line.end_time !== undefined">-</span>
                    <span v-if="line.end_time !== undefined">
                      {{ line.end_time }}
                    </span>
                  </div>
                  <LyricsTextarea
                    v-model="createColumnModel(i, j, k, l).value"
                    :data-input="`${i}-${j}-${k}-${l}`"
                    :verse-styles="getVerseStyles(line, currentCollection)"
                    :readonly="copyColorFromMode"
                    :class="{ 'cursor-pointer': copyColorFromMode }"
                    @focus="
                      onInputFocus({ stanzaIndex: i, itemIndex: j, columnIndex: k, lineIndex: l })
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
