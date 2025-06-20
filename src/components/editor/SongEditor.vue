<script setup lang="ts">
import { Braces, Music, X } from "lucide-vue-next";
import { ref } from "vue";

import LyricsJsonTab from "@/components/editor/LyricsJsonTab.vue";
import LyricsTab from "@/components/editor/LyricsTab.vue";
import SongTab from "@/components/editor/SongTab.vue";

const emit = defineEmits<{
  "toggle-edit": [];
}>();

const activeTab = ref("song");
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
          @click="activeTab = 'song'"
        >
          <Music class="size-3.5" /> Canción
        </a>
        <!-- <a
          role="tab"
          class="tab gap-1"
          :class="{ 'tab-active': activeTab === 'lyrics' }"
          @click="activeTab = 'lyrics'"
        >
          <MicVocal class="size-3.5" /> Letra
        </a> -->
        <a
          role="tab"
          class="tab gap-1"
          :class="{ 'tab-active': activeTab === 'lyrics-json' }"
          @click="activeTab = 'lyrics-json'"
        >
          <Braces class="size-3.5" />
          Letra (JSON)
        </a>
      </div>

      <div class="flex items-center gap-2">
        <div data-song-editor-actions></div>
        <button class="btn btn-xs btn-square btn-soft" @click="emit('toggle-edit')">
          <X class="size-3.5" />
        </button>
      </div>
    </div>

    <div class="flex-1 min-h-0">
      <SongTab v-if="activeTab === 'song'" />
      <LyricsTab v-if="activeTab === 'lyrics'" />
      <LyricsJsonTab v-if="activeTab === 'lyrics-json'" />
    </div>
  </div>
</template>
