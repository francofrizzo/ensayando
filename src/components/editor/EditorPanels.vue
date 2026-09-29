<script setup lang="ts">
import { ref, watch } from "vue";

import LyricsJsonTab from "@/components/editor/LyricsJsonTab.vue";
import LyricsTab from "@/components/editor/LyricsTab.vue";
import SongTab from "@/components/editor/SongTab.vue";
import { IconBack, IconMarkTime } from "@/components/ui/icons";
import { type EditorTabId, useEditorSession } from "@/composables/useEditorSession";

const props = defineProps<{ tab: EditorTabId }>();

const session = useEditorSession();

// The song form keeps local state, so it mounts the first time it's opened and stays
// mounted (its changes and dirty dot survive switching tabs). Lyrics live in the store,
// so their editors mount only while visible, which also keeps their shortcuts scoped.
const songFormMounted = ref(false);
watch(
  () => props.tab,
  (tab) => {
    session.activeTab.value = tab;
    if (tab === "cancion") songFormMounted.value = true;
    if (tab !== "letra") session.jsonOpen.value = false;
  },
  { immediate: true }
);
</script>

<template>
  <!-- Opaque sheet: you type here, so no glass behind the text -->
  <div
    class="bg-base-100 rounded-box ring-base-content/8 relative flex min-h-0 flex-1 flex-col overflow-hidden shadow-sm ring-1"
    data-testid="editor-panels"
  >
    <div
      v-if="songFormMounted"
      v-show="props.tab === 'cancion'"
      class="min-h-0 flex-1"
      role="tabpanel"
    >
      <SongTab />
    </div>

    <div
      v-if="props.tab === 'letra' && !session.jsonOpen.value"
      class="min-h-0 flex-1"
      role="tabpanel"
    >
      <LyricsTab />
    </div>

    <div
      v-if="props.tab === 'letra' && session.jsonOpen.value"
      class="flex min-h-0 flex-1 flex-col"
      role="tabpanel"
      data-testid="json-editor"
    >
      <div class="border-base-content/8 flex items-center gap-3 border-b px-4 py-2.5">
        <button
          class="btn btn-sm btn-ghost gap-1.5 rounded-full font-semibold"
          @click="session.jsonOpen.value = false"
        >
          <IconBack class="size-4" />
          Volver a la letra
        </button>
        <span class="text-base-content/60 hidden text-[12.5px] sm:inline">
          Editar como JSON (avanzado). Los cambios válidos se ven en la letra al instante.
        </span>
      </div>
      <div class="min-h-0 flex-1">
        <LyricsJsonTab />
      </div>
    </div>

    <div
      v-if="props.tab === 'sincronizar'"
      class="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-10 text-center"
      role="tabpanel"
    >
      <IconMarkTime class="text-base-content/40 size-12" />
      <h2 class="font-display text-xl font-bold">Sincronizar</h2>
      <p class="text-base-content/60 max-w-sm text-sm">
        Próximamente. Mientras tanto, los tiempos de cada verso se marcan desde la pestaña Letra.
      </p>
    </div>
  </div>
</template>
