<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

import SyncTimeline, {
  type TimelineRegion,
  type TimelineTrack
} from "@/components/editor/SyncTimeline.vue";
import ProgressBar from "@/components/player/ProgressBar.vue";
import {
  IconHistory,
  IconMarkTime,
  IconMinus,
  IconPause,
  IconPlay,
  IconPlus,
  IconUndo
} from "@/components/ui/icons";
import { useCollectionPalette } from "@/composables/useCollectionPalette";
import { usePlayerState } from "@/composables/useCurrentTime";
import { useEditorTab } from "@/composables/useEditorSession";
import { useLyricsColoring } from "@/composables/useLyricsColoring";
import { useReactionOffset } from "@/composables/useReactionOffset";
import type { LyricStanza } from "@/data/types";
import { useCollectionsStore } from "@/stores/collections";
import {
  buildSyncUnits,
  countNewTimes,
  firstUnmarkedIndex,
  markEnd,
  markStart,
  regionEnd,
  setUnitTimes,
  type SyncUnit,
  unitState
} from "@/utils/syncMarking";
import {
  applyRegionDrag,
  formatClock,
  type Region,
  SYNC_ZOOMS,
  type SyncZoom
} from "@/utils/syncTimeline";

const store = useCollectionsStore();
const player = usePlayerState();
const collection = computed(() => store.currentCollection);
const { trackColor } = useCollectionPalette(collection);
const { getVerseStyles } = useLyricsColoring();
const { offset, nudge: nudgeReaction, apply: applyReaction } = useReactionOffset();

const lyrics = computed(() => store.localLyrics.value as LyricStanza[]);
const units = computed(() => buildSyncUnits(lyrics.value));
const duration = computed(() => player.totalDuration.value);
const currentTime = computed(() => player.currentTime.value);
const playing = computed(() => player.isPlaying.value);

// Where the next ↓ lands. Starts at the first verse without a time.
const cursor = ref(firstUnmarkedIndex(units.value));
watch(
  () => units.value.length,
  (length) => {
    if (cursor.value > length - 1) cursor.value = Math.max(0, length - 1);
  }
);
const selected = ref<number | null>(null);
const zoom = ref<SyncZoom>("30");
// Short songs fit whole; longer ones start at 30 s so regions are wide enough to grab.
watch(
  duration,
  (value, previousValue) => {
    if (!previousValue && value > 0) zoom.value = value <= 45 ? "toda" : "30";
  },
  { immediate: true }
);

const current = computed<SyncUnit | undefined>(() => units.value[cursor.value]);
const previous = computed<SyncUnit | undefined>(() => units.value[cursor.value - 1]);
const upcoming = computed<SyncUnit | undefined>(() => units.value[cursor.value + 1]);
const markedCount = computed(() => units.value.filter((unit) => unit.start !== undefined).length);

// Times written since the last save: they also light the Sincronizar tab's dot.
// Saving and discarding go through the lyrics ("letra") handle, the single source of truth.
const newTimes = computed(() => countNewTimes(store.savedLyrics, lyrics.value));
useEditorTab("sincronizar", {
  isDirty: () => newTimes.value > 0,
  save: async () => {},
  discard: () => {}
});

const commit = (next: LyricStanza[]) => {
  if (next !== lyrics.value) void store.updateLocalLyrics(next);
};

const markTime = () => applyReaction(currentTime.value);

// ---------- actions ----------
const markAndAdvance = () => {
  if (!current.value) return;
  commit(markStart(lyrics.value, units.value, cursor.value, markTime()));
  if (cursor.value < units.value.length - 1) cursor.value += 1;
  selected.value = null;
};

const markStartOnly = () => {
  if (!current.value) return;
  commit(markStart(lyrics.value, units.value, cursor.value, markTime()));
};

// The end belongs to the verse that's sounding: the current one once it has a start,
// otherwise the one just marked.
const markEndNow = () => {
  const index = current.value?.start !== undefined ? cursor.value : cursor.value - 1;
  const unit = units.value[index];
  if (unit) commit(markEnd(lyrics.value, unit, markTime()));
};

const back = (seconds: number) => player.seekTo(Math.max(0, currentTime.value - seconds));

/** Chooses where to start: two seconds before the verse, or where the previous one ended. */
const startFrom = (index: number) => {
  cursor.value = index;
  selected.value = null;
  const unit = units.value[index];
  const before = units.value[index - 1];
  const anchor = unit?.start ?? before?.end ?? before?.start ?? 0;
  player.seekTo(Math.max(0, anchor - 2));
};

const nudgeOffset = (direction: 1 | -1) => nudgeReaction(direction);

// ---------- timeline ----------
const regions = computed<TimelineRegion[]>(() =>
  units.value.flatMap((unit, index) => {
    const end = regionEnd(units.value, index, duration.value);
    if (unit.start === undefined || end === undefined) return [];
    return [
      {
        index,
        start: unit.start,
        end,
        label: unit.texts.join(" · "),
        ink: trackColor(unit.colorKeys[0], "lyric"),
        wave: trackColor(unit.colorKeys[0], "wave")
      }
    ];
  })
);

const tracks = computed<TimelineTrack[]>(() =>
  [...(store.currentSong?.audio_tracks ?? [])]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((track) => ({
      id: track.id,
      title: track.title,
      color: trackColor(track.color_key, "wave"),
      peaks: track.peaks?.channels?.[0] ?? null,
      peaksDuration: track.peaks?.duration ?? 0
    }))
);

const onRegionChange = (index: number, region: Region) => {
  const unit = units.value[index];
  if (unit) commit(setUnitTimes(lyrics.value, unit, region.start, region.end));
};

// Double-click a region: play just that verse.
const stopAt = ref<number | null>(null);
const playRegion = (index: number) => {
  const region = regions.value.find((r) => r.index === index);
  if (!region) return;
  player.seekTo(region.start);
  stopAt.value = region.end;
  player.playPause(true);
};
watch(currentTime, (time) => {
  if (stopAt.value !== null && time >= stopAt.value) {
    stopAt.value = null;
    player.playPause(false);
  }
});
watch(playing, (isPlaying) => {
  if (!isPlaying) stopAt.value = null;
});

const moveSelected = (delta: number) => {
  const region = regions.value.find((r) => r.index === selected.value);
  const unit = selected.value !== null ? units.value[selected.value] : undefined;
  if (!region || !unit) return;
  const moved = applyRegionDrag(region, "move", delta, duration.value);
  commit(setUnitTimes(lyrics.value, unit, moved.start, moved.end));
};

// ---------- keyboard ----------
const isTyping = (target: EventTarget | null) =>
  !!(target as HTMLElement | null)?.closest?.("input, textarea, [contenteditable='true']");

// Capture phase: with a region selected, ← → move it instead of seeking.
const onKeydownCapture = (event: KeyboardEvent) => {
  if (isTyping(event.target) || selected.value === null) return;
  if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && !event.metaKey && !event.ctrlKey && !event.altKey) {
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? 1 : 0.1;
    moveSelected(event.key === "ArrowLeft" ? -step : step);
  }
};

const onKeydown = (event: KeyboardEvent) => {
  if (isTyping(event.target)) return;
  const command = event.metaKey || event.ctrlKey;
  if (event.key === "ArrowDown" && !command && !event.altKey && !event.shiftKey) {
    // No text cursor here, so plain ↓ marks (⌘↓ still does it in Letra).
    event.preventDefault();
    markAndAdvance();
  } else if (command && !event.altKey && event.key === ",") {
    event.preventDefault();
    markStartOnly();
  } else if (command && !event.altKey && event.key === ".") {
    event.preventDefault();
    markEndNow();
  } else if (command && event.key.toLowerCase() === "z") {
    event.preventDefault();
    if (event.shiftKey) store.redo();
    else store.undo();
  } else if (command && event.key.toLowerCase() === "g") {
    event.preventDefault();
    startFrom(cursor.value);
  } else if (event.key === "Escape" && selected.value !== null) {
    selected.value = null;
  }
};

// ---------- layout ----------
const phoneQuery = window.matchMedia("(max-width: 767px)");
const isPhone = ref(phoneQuery.matches);
const onPhoneChange = (event: MediaQueryListEvent) => (isPhone.value = event.matches);

onMounted(() => {
  window.addEventListener("keydown", onKeydownCapture, true);
  window.addEventListener("keydown", onKeydown);
  phoneQuery.addEventListener("change", onPhoneChange);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydownCapture, true);
  window.removeEventListener("keydown", onKeydown);
  phoneQuery.removeEventListener("change", onPhoneChange);
});

const verseStyle = (unit: SyncUnit | undefined, past = false) =>
  unit && collection.value
    ? getVerseStyles({ text: "", color_keys: unit.colorKeys }, collection.value, past ? "past" : "future")
    : {};

const unitText = (unit: SyncUnit | undefined) => unit?.texts.join(" · ") ?? "";

const contextLabel = computed(() => {
  const unit = current.value;
  if (!unit) return "";
  const parts = [unit.comment ?? `Estrofa ${unit.stanzaIndex + 1}`];
  if (unit.start !== undefined) parts.push(`empezó en ${formatClock(unit.start, 2).replace(".", ",")}`);
  return parts.join(" · ");
});

const offsetLabel = computed(() => `−${offset.value.toFixed(2).replace(".", ",")} s`);
const listItems = ref<HTMLElement[]>([]);
watch(cursor, (index) => listItems.value[index]?.scrollIntoView({ block: "nearest" }));
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col" data-testid="sync-panel">
    <div
      v-if="units.length === 0"
      class="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center"
    >
      <IconMarkTime class="text-base-content/40 size-12" />
      <h2 class="font-display text-xl font-bold">Todavía no hay versos</h2>
      <p class="text-base-content/60 max-w-sm text-sm">
        Escribí la letra en la pestaña Letra y volvé para marcar sus tiempos.
      </p>
    </div>

    <!-- ================= Desktop ================= -->
    <template v-else-if="!isPhone">
      <div class="flex min-h-0 flex-1 gap-3 p-3">
        <!-- Stage: the verse being marked, with the previous and the next -->
        <div class="flex min-w-0 flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
          <span
            v-if="previous"
            class="font-lyrics text-xl font-medium tracking-[0.02em] uppercase"
            :style="verseStyle(previous, true)"
            >{{ unitText(previous) }}</span
          >
          <div class="flex flex-col items-center gap-3">
            <span
              class="text-base-content/50 flex items-center gap-2 text-[10.5px] font-semibold tracking-[0.14em] uppercase"
            >
              <span class="badge badge-sm bg-collection-soft text-collection-ink border-0 font-semibold"
                >Marcando</span
              >
              {{ contextLabel }}
            </span>
            <span
              class="font-lyrics text-[34px] leading-tight font-bold tracking-[0.02em] text-balance uppercase dark:drop-shadow-[0_0_18px_color-mix(in_oklch,var(--collection-ink)_45%,transparent)]"
              :style="verseStyle(current)"
              data-testid="sync-current"
              >{{ unitText(current) }}</span
            >
          </div>
          <div v-if="upcoming" class="flex flex-col items-center gap-2">
            <span
              class="text-base-content/50 flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.14em] uppercase"
            >
              Sigue · <kbd class="kbd kbd-xs">↓</kbd> al empezar
            </span>
            <span
              class="font-lyrics text-xl font-medium tracking-[0.02em] uppercase"
              :style="verseStyle(upcoming)"
              >{{ unitText(upcoming) }}</span
            >
          </div>
        </div>

        <!-- Verse list -->
        <div
          class="border-base-content/10 flex w-[332px] shrink-0 flex-col overflow-hidden rounded-box border"
        >
          <div class="border-base-content/10 flex items-baseline justify-between border-b px-4 py-3">
            <span class="text-sm font-semibold">Versos</span>
            <span class="text-base-content/55 text-xs"
              >{{ markedCount }} de {{ units.length }} con tiempo<template v-if="newTimes > 0">
                ·
                <b class="text-warning font-semibold" data-testid="sync-new-times"
                  >{{ newTimes }} {{ newTimes === 1 ? "nuevo" : "nuevos" }}</b
                ></template
              ></span
            >
          </div>
          <ol class="min-h-0 flex-1 overflow-y-auto" data-testid="sync-list">
            <li v-for="(unit, index) in units" :key="unit.id" ref="listItems">
              <button
                class="border-base-content/8 hover:bg-base-content/5 grid w-full grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-2.5 border-b px-4 py-2 text-left"
                :class="{ 'bg-collection-soft/60': index === cursor }"
                :data-state="unitState(unit, index === cursor)"
                data-testid="sync-row"
                @click="startFrom(index)"
              >
                <span
                  class="size-2 rounded-full"
                  :style="{ background: trackColor(unit.colorKeys[0], 'wave') }"
                />
                <span
                  class="font-lyrics truncate text-[12.5px] font-medium tracking-[0.02em] uppercase"
                  >{{ unitText(unit) }}</span
                >
                <span
                  v-if="index === cursor"
                  class="badge badge-sm bg-collection-soft text-collection-ink border-0 font-semibold"
                  >Marcando</span
                >
                <span
                  v-else-if="unit.start !== undefined"
                  class="text-base-content/60 font-mono text-[11.5px] tabular-nums"
                  data-testid="sync-row-time"
                  >{{ formatClock(unit.start, 2) }}</span
                >
                <span v-else class="text-base-content/40 text-[11px] italic uppercase">sin tiempo</span>
              </button>
            </li>
          </ol>
        </div>
      </div>

      <!-- Transport + timeline -->
      <div class="border-base-content/10 bg-base-200/60 flex flex-col gap-2.5 border-t px-4 pt-3 pb-3">
        <div class="flex flex-wrap items-center gap-3">
          <button
            class="btn btn-circle btn-primary play-glow size-11 border-0"
            :aria-label="playing ? 'Pausar' : 'Reproducir'"
            :disabled="!player.isReady.value"
            data-testid="sync-play"
            @click="player.playPause()"
          >
            <span v-if="!player.isReady.value" class="loading loading-spinner loading-sm" />
            <IconPause v-else-if="playing" class="size-5" />
            <IconPlay v-else class="size-5 translate-x-[1px]" />
          </button>
          <span class="font-mono text-[13px] tabular-nums whitespace-nowrap">
            <span class="text-[15px] font-semibold" data-testid="sync-clock">{{ formatClock(currentTime) }}</span
            ><span class="text-base-content/40 text-[11px]"
              >.{{ Math.floor((currentTime % 1) * 10) }}</span
            >
            <span class="text-base-content/60"> / {{ formatClock(duration) }}</span>
          </span>
          <button
            class="btn btn-primary h-[46px] gap-2.5 rounded-full px-[18px] text-[15px] font-semibold shadow-[0_10px_26px_-10px_var(--color-primary)]"
            data-testid="sync-mark"
            @click="markAndAdvance"
          >
            <IconMarkTime class="size-5" />
            Marcar inicio y avanzar
            <kbd class="kbd kbd-sm border-white/35 bg-white/20 text-inherit">↓</kbd>
          </button>
          <button class="btn btn-sm bg-base-content/7 gap-1.5 rounded-full border-0" @click="markEndNow">
            Marcar fin <kbd class="kbd kbd-xs">⌘.</kbd>
          </button>
          <button class="btn btn-sm bg-base-content/7 gap-1.5 rounded-full border-0" @click="back(3)">
            <IconHistory class="size-4" /> Volver 3 s
          </button>
          <div class="ml-auto flex items-center gap-3">
            <span class="text-base-content/60 flex items-center gap-1.5 text-[12.5px] font-medium">
              Corrección por reacción
              <button
                class="btn btn-xs btn-circle btn-ghost"
                aria-label="Menos corrección"
                @click="nudgeOffset(-1)"
              >
                <IconMinus class="size-3.5" />
              </button>
              <b class="text-base-content font-mono text-[13px] tabular-nums" data-testid="sync-offset">{{
                offsetLabel
              }}</b>
              <button
                class="btn btn-xs btn-circle btn-ghost"
                aria-label="Más corrección"
                @click="nudgeOffset(1)"
              >
                <IconPlus class="size-3.5" />
              </button>
            </span>
            <div role="radiogroup" aria-label="Zoom" class="bg-base-content/7 flex gap-0.5 rounded-full p-[3px]">
              <button
                v-for="option in SYNC_ZOOMS"
                :key="option.id"
                role="radio"
                :aria-checked="zoom === option.id"
                class="rounded-full px-3 py-[5px] text-[12.5px] font-semibold"
                :class="
                  zoom === option.id
                    ? 'bg-base-100 text-base-content shadow-sm'
                    : 'text-base-content/60 hover:text-base-content'
                "
                @click="zoom = option.id"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
        </div>
        <SyncTimeline
          :regions="regions"
          :tracks="tracks"
          :duration="duration"
          :current-time="currentTime"
          :playing="playing"
          :zoom="zoom"
          :selected-index="selected"
          @seek="player.seekTo"
          @select="(index) => (selected = index)"
          @change="onRegionChange"
          @play-region="playRegion"
        />
      </div>
    </template>

    <!-- ================= Phone: tap along ================= -->
    <template v-else>
      <div class="flex min-h-0 flex-1 flex-col items-center justify-center gap-3.5 px-5 text-center">
        <span
          v-if="previous"
          class="font-lyrics text-lg font-medium uppercase"
          :style="verseStyle(previous, true)"
          >{{ unitText(previous) }}</span
        >
        <span class="badge badge-sm bg-collection-soft text-collection-ink border-0 font-semibold"
          >Marcando</span
        >
        <span
          class="font-lyrics text-2xl leading-tight font-bold uppercase"
          :style="verseStyle(current)"
          data-testid="sync-current"
          >{{ unitText(current) }}</span
        >
        <template v-if="upcoming">
          <span class="text-base-content/50 text-[10.5px] font-semibold tracking-[0.14em] uppercase"
            >Sigue</span
          >
          <span class="font-lyrics text-lg font-medium uppercase" :style="verseStyle(upcoming)">{{
            unitText(upcoming)
          }}</span>
        </template>
      </div>
      <div class="border-base-content/10 bg-base-200/60 flex flex-col gap-3 border-t px-4 pt-3 pb-4">
        <div class="flex items-center justify-between">
          <span class="font-mono text-[13px] tabular-nums">
            <span class="font-semibold">{{ formatClock(currentTime) }}</span>
            <span class="text-base-content/60"> / {{ formatClock(duration) }}</span>
          </span>
          <span class="text-base-content/60 flex items-center gap-1 text-xs">
            Reacción
            <button class="btn btn-xs btn-circle btn-ghost" aria-label="Menos corrección" @click="nudgeOffset(-1)">
              <IconMinus class="size-3" />
            </button>
            <b class="text-base-content font-mono">{{ offsetLabel }}</b>
            <button class="btn btn-xs btn-circle btn-ghost" aria-label="Más corrección" @click="nudgeOffset(1)">
              <IconPlus class="size-3" />
            </button>
          </span>
        </div>
        <ProgressBar :current-time="currentTime" :total-duration="duration" @seek="player.seekTo" />
        <button
          class="btn btn-primary play-glow flex h-24 flex-col gap-1 rounded-[22px] border-0 text-lg font-bold"
          data-testid="sync-mark"
          @click="markAndAdvance"
        >
          <span class="flex items-center gap-2"><IconMarkTime class="size-7" />Marcar</span>
          <span class="max-w-full truncate px-4 text-xs font-medium opacity-80"
            >inicio de “{{ unitText(current) }}”</span
          >
        </button>
        <div class="flex items-center justify-between">
          <button
            class="btn bg-base-content/7 gap-1.5 rounded-full border-0"
            :disabled="!store.canUndo"
            @click="store.undo()"
          >
            <IconUndo class="size-4" /> Deshacer
          </button>
          <button
            class="btn btn-circle btn-primary play-glow size-11 border-0"
            :aria-label="playing ? 'Pausar' : 'Reproducir'"
            :disabled="!player.isReady.value"
            @click="player.playPause()"
          >
            <IconPause v-if="playing" class="size-5" />
            <IconPlay v-else class="size-5 translate-x-[1px]" />
          </button>
          <button class="btn bg-base-content/7 gap-1.5 rounded-full border-0" @click="back(3)">
            <IconHistory class="size-4" /> Volver 3 s
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
