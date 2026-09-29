<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, computed } from "vue";

import {
  IconClose,
  IconCode,
  IconDiscard,
  IconLyrics,
  IconMarkTime,
  IconMore,
  IconMusic,
  IconSave
} from "@/components/ui/icons";
import {
  EDITOR_TABS,
  type EditorTabId,
  savedLabel,
  useEditorSession
} from "@/composables/useEditorSession";

const props = withDefaults(
  defineProps<{
    title: string;
    /** Label before the title. */
    eyebrow?: string;
    tab?: EditorTabId;
    /** Hide the tabs (e.g. "Nueva canción" only has the song form). */
    showTabs?: boolean;
    /** Offer "Editar como JSON (avanzado)". */
    showJson?: boolean;
    /** Label of the primary button. */
    saveLabel?: string;
  }>(),
  { eyebrow: "Editando", tab: "cancion", showTabs: true, showJson: true, saveLabel: "Guardar" }
);

const emit = defineEmits<{
  exit: [];
  tab: [tab: EditorTabId];
}>();

const session = useEditorSession();

const TAB_ICONS = { cancion: IconMusic, letra: IconLyrics, sincronizar: IconMarkTime } as const;
const tabs = EDITOR_TABS.map((tab) => ({ ...tab, icon: TAB_ICONS[tab.id] }));

// Refresh "Guardado hace un momento" into "Guardado a las …"
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  timer = setInterval(() => (now.value = Date.now()), 15_000);
});
onBeforeUnmount(() => clearInterval(timer));

const status = computed(() => {
  if (session.isSaving.value) return { text: "Guardando…", dirty: false };
  if (session.isDirty.value) return { text: "Cambios sin guardar", dirty: true };
  const saved = savedLabel(session.lastSavedAt.value, now.value);
  return saved ? { text: saved, dirty: false } : null;
});

const onSave = async () => {
  now.value = Date.now();
  await session.save();
};

const openJson = (event: Event) => {
  session.jsonOpen.value = true;
  emit("tab", "letra");
  (event.currentTarget as HTMLElement | null)?.blur();
};
</script>

<template>
  <header
    class="glass-1 relative flex h-14 items-center gap-2 rounded-[18px] px-1.5 md:h-[60px] md:gap-3 md:px-2.5"
    data-testid="edit-bar"
  >
    <button
      class="btn btn-sm btn-circle bg-base-content/7 hover:bg-base-content/12 shrink-0 border-0 shadow-none"
      aria-label="Salir del modo edición"
      title="Salir (Esc)"
      data-testid="exit-edit"
      @click="emit('exit')"
    >
      <IconClose class="size-[18px]" />
    </button>

    <div class="flex min-w-0 flex-col gap-1 leading-none">
      <span class="text-collection-ink text-[11px] font-semibold tracking-[0.1em] uppercase">
        {{ props.eyebrow }}
      </span>
      <span class="font-display truncate text-[15px] font-bold md:text-[17px]">{{
        props.title
      }}</span>
    </div>

    <!-- Tabs: centered on desktop, below the bar on phone (EditorTabsPhone) -->
    <div
      v-if="props.showTabs"
      role="tablist"
      aria-label="Qué editar"
      class="bg-base-content/7 absolute inset-x-0 mx-auto hidden w-fit gap-0.5 rounded-full p-[3px] md:flex"
    >
      <button
        v-for="item in tabs"
        :key="item.id"
        role="tab"
        :aria-selected="props.tab === item.id"
        class="flex items-center gap-1.5 rounded-full px-3.5 py-[7px] text-[13px] font-semibold transition-colors"
        :class="
          props.tab === item.id
            ? 'bg-base-100 text-base-content shadow-sm'
            : 'text-base-content/60 hover:text-base-content'
        "
        :data-testid="`edit-tab-${item.id}`"
        @click="emit('tab', item.id)"
      >
        <component :is="item.icon" class="size-[15px]" />
        {{ item.label }}
        <span
          v-if="session.dirtyByTab.value[item.id]"
          class="bg-warning size-1.5 rounded-full"
          aria-label="con cambios sin guardar"
        />
      </button>
    </div>

    <div class="ml-auto flex shrink-0 items-center gap-1 md:gap-1.5">
      <span
        v-if="status"
        class="text-base-content/60 hidden items-center gap-1.5 text-[12.5px] font-medium lg:flex"
        data-testid="save-status"
      >
        <span v-if="status.dirty" class="bg-warning size-1.5 rounded-full" />
        {{ status.text }}
      </span>

      <!-- Tab-specific actions (help, advanced options) teleport here -->
      <div class="flex items-center gap-1" data-song-editor-actions></div>

      <button
        v-if="session.isDirty.value"
        class="btn btn-sm bg-base-content/7 hover:bg-base-content/12 gap-1.5 rounded-full border-0 font-semibold shadow-none"
        :disabled="session.isSaving.value"
        data-testid="discard-changes"
        @click="session.discard()"
      >
        <IconDiscard class="size-4 md:hidden" />
        <span class="hidden md:inline">Descartar</span>
      </button>
      <button
        class="btn btn-sm btn-primary gap-1.5 rounded-full font-semibold"
        :disabled="!session.canSave.value"
        title="Guardar (⌘S)"
        data-testid="save-changes"
        @click="onSave"
      >
        <span v-if="session.isSaving.value" class="loading loading-spinner loading-xs" />
        <IconSave v-else class="size-4" />
        <span class="hidden md:inline">{{ props.saveLabel }}</span>
      </button>

      <div v-if="props.showJson" class="dropdown dropdown-end">
        <div
          tabindex="0"
          role="button"
          class="btn btn-sm btn-circle btn-ghost"
          aria-label="Más opciones"
        >
          <IconMore class="size-[18px]" />
        </div>
        <ul tabindex="0" class="dropdown-content menu glass-3 rounded-box z-50 mt-2 w-72 p-1.5">
          <li>
            <button data-testid="open-json" @click="openJson">
              <IconCode class="size-[17px] opacity-70" />
              Editar como JSON
              <span class="text-base-content/50 ml-auto text-xs">avanzado</span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  </header>

  <!-- Phone: tabs under the bar -->
  <div v-if="props.showTabs" class="mt-2 flex md:hidden">
    <div
      role="tablist"
      aria-label="Qué editar"
      class="bg-base-content/7 flex w-full gap-0.5 rounded-full p-[3px]"
    >
      <button
        v-for="item in tabs"
        :key="item.id"
        role="tab"
        :aria-selected="props.tab === item.id"
        class="flex flex-1 items-center justify-center gap-1.5 rounded-full py-[7px] text-[13px] font-semibold"
        :class="
          props.tab === item.id ? 'bg-base-100 text-base-content shadow-sm' : 'text-base-content/60'
        "
        @click="emit('tab', item.id)"
      >
        {{ item.label }}
        <span v-if="session.dirtyByTab.value[item.id]" class="bg-warning size-1.5 rounded-full" />
      </button>
    </div>
  </div>
</template>
