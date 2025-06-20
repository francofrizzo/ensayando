<script setup lang="ts">
import { Save, X } from "lucide-vue-next";
import { computed, ref } from "vue";
import { toast } from "vue-sonner";

import LyricsJsonTab from "@/components/LyricsJsonTab.vue";
import LyricsTab from "@/components/LyricsTab.vue";
import SongTab from "@/components/SongTab.vue";
import { useAuthStore } from "@/stores/auth";
import { useCollectionsStore } from "@/stores/collections";

const store = useCollectionsStore();
const authStore = useAuthStore();

const emit = defineEmits<{
  "toggle-edit": [];
}>();

const activeTab = ref("json");
const lyricsJsonTabRef = ref<any>(null);
const hasValidationErrors = ref(false);

const handleSaveClick = () => {
  if (activeTab.value === "json" && lyricsJsonTabRef.value) {
    lyricsJsonTabRef.value.handleSaveClick();
  } else {
    toast.info("Funcionalidad de guardado no disponible para esta pestaña");
  }
};

// Move the save button state logic to parent component for proper reactivity
const isSaveDisabled = computed(() => {
  if (activeTab.value === "json") {
    return (
      !authStore.isAuthenticated ||
      !store.localLyrics.isDirty ||
      store.localLyrics.isSaving ||
      hasValidationErrors.value
    );
  } else {
    return true;
  }
});

// Handle validation errors from child component
const handleValidationChange = (hasErrors: boolean) => {
  hasValidationErrors.value = hasErrors;
};
</script>

<template>
  <div class="h-screen flex flex-col">
    <div class="flex items-center justify-between p-1.5">
      <div class="tabs tabs-border tabs-xs">
        <a class="tab" :class="{ 'tab-active': activeTab === 'song' }" @click="activeTab = 'song'">
          Canción
        </a>
        <a
          class="tab"
          :class="{ 'tab-active': activeTab === 'lyrics' }"
          @click="activeTab = 'lyrics'"
        >
          Letra
        </a>
        <a class="tab" :class="{ 'tab-active': activeTab === 'json' }" @click="activeTab = 'json'">
          Letra (JSON)
        </a>
      </div>

      <div class="flex items-center gap-2">
        <button
          class="btn btn-xs btn-primary"
          :disabled="isSaveDisabled"
          :class="{ 'btn-error': hasValidationErrors }"
          @click="handleSaveClick"
        >
          <template v-if="store.localLyrics.isSaving">
            <span class="loading loading-spinner loading-xs"></span>
            <span>Guardando...</span>
          </template>
          <template v-else-if="hasValidationErrors">
            <X class="size-3.5" />
            <span class="hidden md:block">Hay errores</span>
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
    </div>

    <div class="flex-1 min-h-0">
      <SongTab v-if="activeTab === 'song'" />
      <LyricsTab v-if="activeTab === 'lyrics'" />
      <LyricsJsonTab
        v-if="activeTab === 'json'"
        ref="lyricsJsonTabRef"
        @validation-change="handleValidationChange"
      />
    </div>
  </div>
</template>
