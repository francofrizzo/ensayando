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

// Initialize keyboard navigation
const { currentFocus, showHelp, handleInputFocus } = useKeyboardLyricsNavigation(
  computed(() => store.localLyrics.value),
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
      const currentLyrics = [...store.localLyrics.value];
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
      const currentLyrics = [...store.localLyrics.value];
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
  <div class="h-full flex flex-col py-2 pl-3 pr-2 min-w-0">
    <div class="flex-1 flex flex-col gap-4">
      <div
        v-for="(stanza, i) in store.localLyrics.value"
        :key="i"
        class="card bg-base-200 border border-base-300 shadow-sm"
      >
        <div class="card-body p-5">
          <div class="flex flex-col gap-1 items-start">
            <template v-for="(item, j) in stanza" :key="`${i}-${j}`">
              <input
                v-if="!Array.isArray(item)"
                v-model="createVerseModel(i, j).value"
                :data-input="`${i}-${j}`"
                type="text"
                class="grow w-full"
                :class="{
                  'ring-2 ring-primary ring-opacity-50':
                    currentFocus?.stanzaIndex === i &&
                    currentFocus?.itemIndex === j &&
                    currentFocus?.columnIndex === undefined
                }"
                @focus="onInputFocus({ stanzaIndex: i, itemIndex: j })"
              />
              <div v-else class="flex flex-row gap-4 items-start">
                <div
                  v-for="(column, k) in item"
                  :key="`${i}-${j}-${k}`"
                  class="flex flex-col gap-1 items-start"
                >
                  <input
                    v-for="(line, l) in column"
                    :key="`${i}-${j}-${k}-${l}`"
                    v-model="createColumnModel(i, j, k, l).value"
                    :data-input="`${i}-${j}-${k}-${l}`"
                    type="text"
                    class="grow"
                    :class="{
                      'ring-2 ring-primary ring-opacity-50':
                        currentFocus?.stanzaIndex === i &&
                        currentFocus?.itemIndex === j &&
                        currentFocus?.columnIndex === k &&
                        currentFocus?.lineIndex === l
                    }"
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

    <!-- Help Modal -->
    <KeyboardHelpModal :show="showHelp" @close="showHelp = false" />
  </div>
</template>
