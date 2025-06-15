<script setup lang="ts">
import { lyricStanzaArrayValidation } from "@/data/validate";
import { useAuthStore } from "@/stores/auth";
import { useCollectionsStore } from "@/stores/collections";
import JsonEditorVue from "json-editor-vue";
import { Save, X } from "lucide-vue-next";
import { Mode } from "vanilla-jsoneditor";
import { ref } from "vue";
import { toast } from "vue-sonner";
import LoginModal from "./LoginModal.vue";

const store = useCollectionsStore();
const authStore = useAuthStore();
const { saveLyrics, updateLocalLyrics } = store;

const emit = defineEmits<{
  "toggle-edit": [];
}>();

const showLoginModal = ref(false);
const lastValidJson = ref<any>(store.localLyrics.value);

const handleSaveClick = () => {
  if (authStore.isAuthenticated()) {
    try {
      saveLyrics();
    } catch (error) {
      toast.error(`Error al guardar letras: ${error}`);
    }
  } else {
    showLoginModal.value = true;
  }
};

const validator = (json: any): { path: string[]; message: string; severity: string }[] => {
  if (json == null) return [];
  let normalizedJson: any;
  try {
    normalizedJson = typeof json === "string" ? JSON.parse(json) : json;
  } catch (error) {
    return [
      {
        path: [],
        message: "Invalid JSON syntax",
        severity: "error" as const
      }
    ];
  }

  const zodResult = lyricStanzaArrayValidation(normalizedJson);
  let result: Array<{ path: string[]; message: string; severity: "error" }> = [];

  if (!zodResult.success) {
    const errors = zodResult.error.errors.slice(0, 10);
    result = errors.map((error) => ({
      path: error.path.map(String),
      message: `${error.path.join(".") || "root"}: ${error.message}`,
      severity: "error" as const
    }));

    if (zodResult.error.errors.length > 10) {
      result.push({
        path: [],
        message: `... and ${zodResult.error.errors.length - 10} more errors`,
        severity: "error" as const
      });
    }
  }
  return result;
};

const onUpdateLyrics = (lyrics: any) => {
  try {
    const parsedLyrics = typeof lyrics === "string" ? JSON.parse(lyrics) : lyrics;
    const errors = validator(parsedLyrics);
    if (
      errors.length === 0 &&
      JSON.stringify(lastValidJson.value) !== JSON.stringify(parsedLyrics)
    ) {
      updateLocalLyrics(parsedLyrics);
      lastValidJson.value = parsedLyrics;
    }
  } catch (error) {
    // Error shown in editor
  }
};
</script>

<template>
  <div class="h-screen flex flex-col">
    <div class="flex items-center justify-between p-1.5">
      <button
        class="btn btn-xs btn-primary"
        :disabled="
          !authStore.isAuthenticated() || !store.localLyrics.isDirty || store.localLyrics.isSaving
        "
        @click="handleSaveClick"
      >
        <template v-if="store.localLyrics.isSaving">
          <span class="loading loading-spinner loading-xs"></span>
          <span>Guardando...</span>
        </template>
        <template v-else>
          <Save class="size-3.5" />
          <span class="hidden md:block">Guardar cambios</span>
        </template>
      </button>

      <button class="btn btn-xs btn-square btn-soft" @click="emit('toggle-edit')">
        <X class="size-3.5" />
      </button>
    </div>
    <JsonEditorVue
      :model-value="store.localLyrics.value"
      :mode="Mode.text"
      :debounce="200"
      :validator="validator"
      class="json-editor flex-1 min-h-0"
      @update:model-value="onUpdateLyrics"
    />

    <!-- Login Modal -->
    <LoginModal v-if="showLoginModal" @close="showLoginModal = false" />
  </div>
</template>
