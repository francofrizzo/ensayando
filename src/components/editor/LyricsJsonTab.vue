<script setup lang="ts">
import { Mode, createAjvValidator } from "vanilla-jsoneditor";
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";

import JsonEditor from "@/components/editor/JsonEditor.vue";
import lyricSchema from "@/data/lyric-schema.json";
import { useAuthStore } from "@/stores/auth";
import { useCollectionsStore } from "@/stores/collections";

const store = useCollectionsStore();
const authStore = useAuthStore();
const { saveLyrics, updateLocalLyrics } = store;

const emit = defineEmits<{
  "validation-change": [hasErrors: boolean];
}>();

const showLoginModal = ref(false);
const hasValidationErrors = ref(false);
const editorRef = ref<any>(null);

const initialContent = {
  text: JSON.stringify(store.localLyrics.value, null, 2)
};

// Watch for song changes and update the editor content
watch(
  () => store.currentSong,
  (newSong) => {
    if (editorRef.value && newSong) {
      const newContent = { text: JSON.stringify(newSong.lyrics ?? [], null, 2) };
      editorRef.value.set(newContent);
    } else if (editorRef.value && !newSong) {
      // Clear editor when no song is selected
      const newContent = { text: JSON.stringify([], null, 2) };
      editorRef.value.set(newContent);
    }
  },
  { immediate: false }
);

// Watch validation errors and emit changes to parent
watch(
  hasValidationErrors,
  (newValue) => {
    emit("validation-change", newValue);
  },
  { immediate: true }
);

const validator = createAjvValidator({ schema: lyricSchema });

let validationTimeout: NodeJS.Timeout | null = null;
const VALIDATION_DELAY = 200;

const isSaveDisabled = computed(() => {
  return (
    !authStore.isAuthenticated ||
    !store.localLyrics.isDirty ||
    store.localLyrics.isSaving ||
    hasValidationErrors.value
  );
});

const handleSaveClick = () => {
  if (hasValidationErrors.value) {
    toast.error("Cannot save: Please fix validation errors first");
    return;
  }

  if (authStore.isAuthenticated) {
    try {
      if (editorRef.value) {
        const currentContent = editorRef.value.get();
        if (currentContent && currentContent.text) {
          const parsedLyrics = JSON.parse(currentContent.text);
          updateLocalLyrics(parsedLyrics);
        }
      }
      saveLyrics();
    } catch (error) {
      toast.error(`Error al guardar letras: ${error}`);
    }
  } else {
    showLoginModal.value = true;
  }
};

const handleEditorChange = (content: any, previousContent: any, { contentErrors }: any) => {
  // Clear existing timeout
  if (validationTimeout) {
    clearTimeout(validationTimeout);
  }

  // Always update store for valid JSON immediately
  if (!contentErrors?.parseErrors?.length && content && content.text) {
    try {
      const parsedLyrics = JSON.parse(content.text);
      // Only validate schema after delay, but update store immediately for valid JSON
      const schemaErrors = validator(parsedLyrics);
      if (schemaErrors.length === 0) {
        updateLocalLyrics(parsedLyrics);
      }
    } catch (error) {
      // JSON parse error - don't update store
    }
  }

  // Debounce validation error state updates
  validationTimeout = setTimeout(() => {
    hasValidationErrors.value =
      contentErrors && contentErrors.validationErrors && contentErrors.validationErrors.length > 0;
  }, VALIDATION_DELAY);
};

defineExpose({
  isSaveDisabled,
  hasValidationErrors,
  handleSaveClick
});
</script>

<template>
  <div class="flex flex-col h-full">
    <JsonEditor
      ref="editorRef"
      :content="initialContent"
      :mode="Mode.text"
      :main-menu-bar="true"
      :navigation-bar="true"
      :validator="validator"
      :on-change="handleEditorChange"
      class="json-editor flex-1 min-h-0"
    />
  </div>
</template>
