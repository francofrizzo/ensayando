<script setup lang="ts">
import { Braces, MicVocal, Music, X } from "lucide-vue-next";
import { onBeforeUnmount, onMounted, ref } from "vue";

import LyricsJsonTab from "@/components/editor/LyricsJsonTab.vue";
import LyricsTab from "@/components/editor/LyricsTab.vue";
import SongTab from "@/components/editor/SongTab.vue";

const emit = defineEmits<{
  "toggle-edit": [];
}>();

const activeTab = ref("song");
const songTabRef = ref<InstanceType<typeof SongTab> | null>(null);
const lyricsJsonTabRef = ref<InstanceType<typeof LyricsJsonTab> | null>(null);
const lyricsTabRef = ref<InstanceType<typeof LyricsTab> | null>(null);

const hasUnsavedChanges = () => {
  const songTabHasChanges = songTabRef.value?.isDirty ?? false;
  const lyricsTabHasChanges = lyricsTabRef.value?.hasUnsavedChanges ?? false;
  const lyricsJsonTabHasChanges = lyricsJsonTabRef.value?.hasUnsavedChanges ?? false;
  return songTabHasChanges || lyricsTabHasChanges || lyricsJsonTabHasChanges;
};

const confirmCloseEditor = (): boolean => {
  if (!hasUnsavedChanges()) {
    return true;
  }

  return confirm("Hay cambios sin guardar. ¿Deseas cerrar el editor? Los cambios se perderán.");
};

const handleCloseEditor = () => {
  if (confirmCloseEditor()) {
    emit("toggle-edit");
  }
};

const handleTabChange = (newTab: string) => {
  // Allow tab switching without confirmation
  // The unsaved changes warning will only apply when closing the entire editor
  activeTab.value = newTab;
};

// Browser navigation protection
const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (hasUnsavedChanges()) {
    event.preventDefault();
    event.returnValue = "";
    return "";
  }
};

onMounted(() => {
  window.addEventListener("beforeunload", handleBeforeUnload);
});

onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", handleBeforeUnload);
});
</script>

<template>
  <div class="h-screen flex flex-col overflow-y-auto">
    <div
      class="flex items-center justify-between p-2 sticky top-0 bg-base-100/50 backdrop-blur-sm z-10"
    >
      <div role="tablist" class="tabs tabs-border tabs-xs">
        <a
          role="tab"
          class="tab gap-1"
          :class="{ 'tab-active': activeTab === 'song' }"
          @click="handleTabChange('song')"
        >
          <Music class="size-3.5" /> Canción
        </a>
        <a
          role="tab"
          class="tab gap-1"
          :class="{ 'tab-active': activeTab === 'lyrics' }"
          @click="handleTabChange('lyrics')"
        >
          <MicVocal class="size-3.5" /> Letra
        </a>
        <a
          role="tab"
          class="tab gap-1"
          :class="{ 'tab-active': activeTab === 'lyrics-json' }"
          @click="handleTabChange('lyrics-json')"
        >
          <Braces class="size-3.5" />
          Letra (JSON)
        </a>
      </div>

      <div class="flex items-center gap-2">
        <div class="flex items-center gap-2" data-song-editor-actions></div>
        <button class="btn btn-xs btn-square btn-soft" @click="handleCloseEditor">
          <X class="size-3.5" />
        </button>
      </div>
    </div>

    <div class="flex-1 min-h-0">
      <SongTab v-if="activeTab === 'song'" ref="songTabRef" />
      <LyricsTab v-if="activeTab === 'lyrics'" ref="lyricsTabRef" />
      <LyricsJsonTab v-if="activeTab === 'lyrics-json'" ref="lyricsJsonTabRef" />
    </div>
  </div>
</template>
