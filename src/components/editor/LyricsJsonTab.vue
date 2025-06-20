<script setup lang="ts">
import { Ban, Save } from "lucide-vue-next";
import { Mode, createAjvValidator } from "vanilla-jsoneditor";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { toast } from "vue-sonner";

import JsonEditor from "@/components/editor/JsonEditor.vue";
import SafeTeleport from "@/components/ui/SafeTeleport.vue";
import lyricSchema from "@/data/lyric-schema.json";
import { useAuthStore } from "@/stores/auth";
import { useCollectionsStore } from "@/stores/collections";

const store = useCollectionsStore();
const authStore = useAuthStore();
const { saveLyrics, updateLocalLyrics } = store;

const hasValidationErrors = ref(false);
const editorRef = ref<any>(null);

const validator = createAjvValidator({ schema: lyricSchema });
const VALIDATION_DELAY = 200;
let validationTimeout: NodeJS.Timeout | null = null;

const initialContent = {
  text: JSON.stringify(store.localLyrics.value, null, 2)
};

const isSaveDisabled = computed(() => {
  return (
    !authStore.isAuthenticated ||
    !store.localLyrics.isDirty ||
    store.localLyrics.isSaving ||
    hasValidationErrors.value
  );
});

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

const handleSaveClick = () => {
  if (hasValidationErrors.value) {
    toast.error("Cannot save: Please fix validation errors first");
    return;
  }

  try {
    if (editorRef.value) {
      const currentContent = editorRef.value.get();
      if (currentContent?.text) {
        const parsedLyrics = JSON.parse(currentContent.text);
        updateLocalLyrics(parsedLyrics);
      }
    }
    saveLyrics();
  } catch (error) {
    toast.error(`Error al guardar letras: ${error}`);
  }
};

const handleEditorChange = (content: any, _previousContent: any, { contentErrors }: any) => {
  if (validationTimeout) {
    clearTimeout(validationTimeout);
  }

  // Update store immediately for valid JSON
  if (!contentErrors?.parseErrors?.length && content?.text) {
    try {
      const parsedLyrics = JSON.parse(content.text);
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
    hasValidationErrors.value = Boolean(
      contentErrors?.validationErrors?.length > 0 || contentErrors?.parseError !== undefined
    );
  }, VALIDATION_DELAY);
};

onBeforeUnmount(() => {
  if (validationTimeout) {
    clearTimeout(validationTimeout);
    validationTimeout = null;
  }
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

    <SafeTeleport to="[data-song-editor-actions]">
      <button
        class="btn btn-xs btn-primary"
        :disabled="isSaveDisabled"
        :class="{ 'btn-error': hasValidationErrors }"
        @click="handleSaveClick"
      >
        <template v-if="store.localLyrics.isSaving">
          <span class="loading loading-spinner loading-xs" />
          <span>Guardando...</span>
        </template>

        <template v-else-if="hasValidationErrors">
          <Ban class="size-3.5" />
          <span class="hidden md:block">Hay errores</span>
        </template>

        <template v-else>
          <Save class="size-3.5" />
          <span class="hidden md:block">Guardar cambios</span>
        </template>
      </button>
    </SafeTeleport>
  </div>
</template>
