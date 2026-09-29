<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";

import { IconWarning } from "@/components/ui/icons";
import { useLyricsColoring } from "@/composables/useLyricsColoring";
import { useTheme } from "@/composables/useTheme";
import type { CollectionWithRole, LyricStanza } from "@/data/types";
import { addStatusToLyrics, type LyricVerseWithStatus } from "@/utils/lyricsViewerUtils";
import { type SyncUnit, unitState } from "@/utils/syncMarking";
import { formatClock } from "@/utils/syncTimeline";

// Sincronizar's stage: the lyrics laid out like the player's (stanzas, columns side by
// side, the sounding verse lit), plus what marking needs: the verse ↓ marks next, which
// verses have no time yet and each verse's start. The layout follows the lyrics as
// written (no merging of overlapping verses), so it doesn't move while times change.

const props = defineProps<{
  collection: CollectionWithRole;
  lyrics: LyricStanza[];
  units: SyncUnit[];
  cursor: number;
  currentTime: number;
  playing: boolean;
  outOfOrder: Set<number>;
  compact?: boolean;
}>();

const emit = defineEmits<{
  pick: [index: number];
}>();

const { getVerseStyles } = useLyricsColoring();
const { resolvedTheme } = useTheme();

const unitIndexById = computed(() => new Map(props.units.map((unit, index) => [unit.id, index])));

type Shown = { verse: LyricVerseWithStatus; index: number | undefined };
type Line = { key: string; columns: Shown[][] };

const stanzas = computed<Line[][]>(() =>
  addStatusToLyrics(props.lyrics, props.currentTime).map((stanza, s) =>
    stanza.map((item, i): Line => {
      if (!Array.isArray(item)) {
        return {
          key: `${s}-${i}`,
          columns: [[{ verse: item, index: unitIndexById.value.get(`${s}-${i}`) }]]
        };
      }
      return {
        key: `${s}-${i}`,
        columns: item.map((column, c) =>
          column.map((verse, l) => ({
            verse,
            index: unitIndexById.value.get(`${s}-${i}-${c}-${l}`)
          }))
        )
      };
    })
  )
);

const verseStyles = (verse: LyricVerseWithStatus) => {
  const styles: Record<string, string | undefined> = {
    ...getVerseStyles(verse, props.collection, verse.status, "stage")
  };
  if (resolvedTheme.value === "dark" && verse.status === "active") {
    styles.filter = `drop-shadow(0 0 16px color-mix(in oklch, ${styles.color ?? "currentColor"} 55%, transparent))`;
  }
  return styles;
};

const lineClass = (columns: number) =>
  columns < 3
    ? "gap-10 px-6 text-xl tracking-[0.02em] md:px-10"
    : columns === 3
      ? "gap-4 px-4 text-base sm:gap-6 md:text-xl"
      : "gap-3 px-3 text-sm sm:gap-5 md:text-lg";

// Follow what matters: the verse to mark next, and while playing, the one sounding.
const scroller = ref<HTMLElement | null>(null);
const center = (selector: string, behavior: ScrollBehavior = "smooth") =>
  nextTick(() =>
    scroller.value?.querySelector(selector)?.scrollIntoView({ behavior, block: "center" })
  );
onMounted(() => center("[data-cursor]", "instant"));
watch(
  () => props.cursor,
  () => center("[data-cursor]")
);
const activeKey = computed(() =>
  stanzas.value
    .flat()
    .flatMap((line) => line.columns.flat())
    .filter((shown) => shown.verse.status === "active")
    .map((shown) => shown.index)
    .join(",")
);
watch(activeKey, (key) => {
  if (props.playing && key) center("[data-active]");
});
</script>

<template>
  <div
    ref="scroller"
    class="font-lyrics min-h-0 flex-1 overflow-y-auto"
    :class="compact ? 'py-[25%]' : 'py-[18vh]'"
    style="mask-image: linear-gradient(transparent, #000 12%, #000 88%, transparent)"
    data-testid="sync-lyrics"
  >
    <div class="flex flex-col gap-7 md:gap-8">
      <div v-for="(stanza, s) in stanzas" :key="s" class="flex flex-col gap-2.5 md:gap-3">
        <div
          v-for="line in stanza"
          :key="line.key"
          class="flex flex-row items-start justify-evenly"
          :class="lineClass(line.columns.length)"
        >
          <div
            v-for="(column, c) in line.columns"
            :key="c"
            class="flex min-w-0 flex-col items-center gap-2"
          >
            <template v-for="(shown, l) in column" :key="l">
              <button
                v-if="shown.index !== undefined"
                type="button"
                class="group flex max-w-full flex-col items-center gap-1 rounded-2xl px-3 py-1.5 transition-[color,background-color,box-shadow,scale] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                :class="[
                  shown.index === cursor
                    ? 'bg-collection-soft/50 ring-collection-ink/70 ring-2'
                    : 'hover:bg-base-content/5',
                  // The whole verse grows, so the ring and background still enclose its text.
                  shown.verse.status === 'active' && 'scale-[1.06]'
                ]"
                :data-state="unitState(units[shown.index]!, shown.index === cursor)"
                :data-cursor="shown.index === cursor || undefined"
                :data-active="shown.verse.status === 'active' || undefined"
                data-testid="sync-verse"
                @click="emit('pick', shown.index)"
              >
                <span
                  v-if="shown.verse.comment"
                  class="text-base-content/45 font-sans text-[11px] leading-none font-semibold tracking-[0.16em] uppercase"
                  >{{ shown.verse.comment }}</span
                >
                <span
                  class="text-center leading-tight text-balance uppercase transition-all duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                  :class="[
                    shown.verse.status === 'active' ? 'font-bold' : 'font-medium',
                    shown.verse.start_time === undefined && shown.index !== cursor && 'opacity-40'
                  ]"
                  :style="verseStyles(shown.verse)"
                  >{{ shown.verse.text }}</span
                >
                <span
                  v-if="shown.index === cursor"
                  class="text-collection-ink flex items-center gap-1 font-sans text-[10.5px] leading-none font-semibold tracking-[0.12em] uppercase"
                >
                  Marcando <kbd class="kbd kbd-xs">↓</kbd>
                </span>
                <span
                  v-else-if="shown.verse.start_time !== undefined"
                  class="flex items-center gap-1 font-mono text-[10.5px] leading-none tabular-nums"
                  :class="outOfOrder.has(shown.index) ? 'text-warning' : 'text-base-content/40'"
                  :title="
                    outOfOrder.has(shown.index) ? 'Empieza antes que un verso anterior' : undefined
                  "
                  data-testid="sync-verse-time"
                  ><IconWarning
                    v-if="outOfOrder.has(shown.index)"
                    class="size-3"
                    aria-hidden="true"
                  />{{ formatClock(shown.verse.start_time, 2) }}</span
                >
                <span
                  v-else
                  class="text-base-content/35 font-sans text-[10.5px] leading-none italic"
                  >sin tiempo</span
                >
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
