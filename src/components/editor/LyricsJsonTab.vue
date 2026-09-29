<script setup lang="ts">
import { IconProhibited } from "@/components/ui/icons";
import {
  Mode,
  createAjvValidator,
  isContentParseError,
  isTextContent,
  type Content,
  type OnChangeStatus
} from "vanilla-jsoneditor";
import { computed, onBeforeUnmount, ref, watch } from "vue";

import JsonEditor from "@/components/editor/JsonEditor.vue";
import { useEditorTab } from "@/composables/useEditorSession";
import lyricSchema from "@/data/lyric-schema.json";
import { useCollectionsStore } from "@/stores/collections";

const store = useCollectionsStore();
const { updateLocalLyrics } = store;

const hasValidationErrors = ref(false);
const editorRef = ref<{ get: () => Content; set: (content: Content) => void } | null>(null);

const validator = createAjvValidator({ schema: lyricSchema });
const VALIDATION_DELAY = 200;
let validationTimeout: ReturnType<typeof setTimeout> | null = null;

const initialContent = {
  text: JSON.stringify(store.localLyrics.value, null, 2)
};

watch(
  () => store.currentSong,
  (newSong) => {
    if (editorRef.value) {
      const newContent = newSong
        ? { text: JSON.stringify(newSong.lyrics ?? [], null, 2) }
        : { text: JSON.stringify([], null, 2) };

      editorRef.value.set(newContent);
    }
  },
  { immediate: false }
);

const handleEditorChange = (
  content: Content,
  _previousContent: Content,
  { contentErrors }: OnChangeStatus
) => {
  if (validationTimeout) {
    clearTimeout(validationTimeout);
  }

  // Update store immediately for valid JSON
  if (!isContentParseError(contentErrors) && isTextContent(content) && content.text) {
    try {
      const parsedLyrics = JSON.parse(content.text);
      const schemaErrors = validator(parsedLyrics);

      if (schemaErrors.length === 0) {
        updateLocalLyrics(parsedLyrics);
      }
    } catch {
      // JSON parse error - don't update store
    }
  }

  // Debounce validation error state updates
  validationTimeout = setTimeout(() => {
    hasValidationErrors.value = Boolean(
      contentErrors !== undefined &&
      (isContentParseError(contentErrors) || contentErrors.validationErrors.length > 0)
    );
  }, VALIDATION_DELAY);
};

onBeforeUnmount(() => {
  if (validationTimeout) {
    clearTimeout(validationTimeout);
    validationTimeout = null;
  }
});

// Lyrics changes are saved by the edit bar; invalid JSON blocks it.
// isDirty mirrors the lyrics so "Descartar" also resets the editor text (after the store).
useEditorTab("letra", {
  isDirty: () => store.localLyrics.isDirty,
  save: async () => {},
  discard: () => {
    editorRef.value?.set({ text: JSON.stringify(store.localLyrics.value, null, 2) });
  },
  canSave: () => !hasValidationErrors.value
});

// Expose hasUnsavedChanges to parent component
defineExpose({
  hasUnsavedChanges: computed(() => store.localLyrics.isDirty)
});
</script>

<template>
  <div class="flex h-full flex-col">
    <JsonEditor
      ref="editorRef"
      :content="initialContent"
      :mode="Mode.text"
      :main-menu-bar="true"
      :navigation-bar="true"
      :validator="validator"
      :on-change="handleEditorChange"
      class="json-editor min-h-0 flex-1"
    />

    <div
      v-if="hasValidationErrors"
      class="bg-error/10 text-error flex items-center gap-2 px-4 py-2 text-[13px] font-medium"
      role="status"
    >
      <IconProhibited class="size-4" />
      El JSON tiene errores. Corregilos para poder guardar.
    </div>
  </div>
</template>
