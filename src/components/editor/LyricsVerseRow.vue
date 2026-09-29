<script setup lang="ts">
import { computed, type CSSProperties } from "vue";

import LyricsTextarea from "@/components/editor/LyricsTextarea.vue";
import { IconComment, IconDragHandle } from "@/components/ui/icons";
import type { LyricVerse } from "@/data/types";
import { formatVerseTime } from "@/utils/lyricsSelection";

const props = defineProps<{
  verse: LyricVerse;
  inputKey: string;
  selected: boolean;
  focused: boolean;
  sounding: boolean;
  showTimes: boolean;
  verseStyles: CSSProperties;
  /** Lyric inks of the verse's colors, in gradient order. */
  dots: string[];
  /** Whole verses can be dragged; lines inside columns move with ⌘⇧↑↓. */
  draggable: boolean;
  dropBefore?: boolean;
  /** For the last line of a column: a verse would land after it. */
  dropAfter?: boolean;
  placeholder?: string;
}>();

const emit = defineEmits<{
  focus: [];
  "update:text": [value: string];
  select: [event: MouseEvent];
  dragstart: [event: DragEvent];
  dragend: [];
}>();

// The gutter has a fixed width so the text always starts at the same place: up to
// four overlapping dots, or three and "+N" when the verse has more colors.
const MAX_DOTS = 4;
const shownDots = computed(() =>
  props.dots.length > MAX_DOTS ? props.dots.slice(0, MAX_DOTS - 1) : props.dots
);
const extraDots = computed(() =>
  props.dots.length > MAX_DOTS ? props.dots.length - (MAX_DOTS - 1) : 0
);

const start = computed(() => formatVerseTime(props.verse.start_time));
const end = computed(() => formatVerseTime(props.verse.end_time));

const focusTextarea = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (target.closest("textarea, button, [draggable='true']")) return;
  const textarea = (event.currentTarget as HTMLElement).querySelector("textarea");
  if (!textarea) return;
  textarea.focus();
  const length = textarea.value.length;
  textarea.setSelectionRange(length, length);
};
</script>

<template>
  <div
    class="group relative flex items-stretch rounded-lg transition-colors"
    :class="[
      selected ? 'bg-base-content/7' : 'hover:bg-base-content/3',
      sounding && !selected ? 'bg-primary/6' : ''
    ]"
    data-lyric-hitbox
    :data-verse-key="inputKey"
    :data-selected="selected || undefined"
    :data-sounding="sounding || undefined"
    @mousedown="emit('select', $event)"
    @click="focusTextarea"
  >
    <span
      v-if="dropBefore"
      class="bg-primary pointer-events-none absolute inset-x-2 -top-px h-0.5 rounded-full"
    />
    <span
      v-if="dropAfter"
      class="bg-primary pointer-events-none absolute inset-x-2 -bottom-px h-0.5 rounded-full"
    />
    <span
      class="absolute inset-y-1.5 left-0 w-[3px] rounded-full transition-colors"
      :class="focused ? 'bg-primary' : selected ? 'bg-primary/50' : 'bg-transparent'"
    />

    <!-- Gutter: drag handle and the verse's colors as dots -->
    <div class="flex w-[52px] shrink-0 items-center gap-1 pl-2 md:w-[64px]">
      <span
        v-if="draggable"
        draggable="true"
        class="text-base-content/40 hover:text-base-content/70 -ml-1 cursor-grab opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        :class="{ 'opacity-100': focused }"
        title="Arrastrar para mover el verso"
        @dragstart="emit('dragstart', $event)"
        @dragend="emit('dragend')"
      >
        <IconDragHandle class="size-4" />
      </span>
      <span v-else class="w-3" />
      <span
        class="flex w-7 shrink-0 items-center justify-end md:w-[34px]"
        :title="`${dots.length} colores`"
      >
        <span
          v-for="(dot, i) in shownDots"
          :key="i"
          class="ring-base-100 size-2 shrink-0 rounded-full ring-2 not-first:-ml-1"
          :style="{ background: dot }"
        />
        <span
          v-if="extraDots"
          class="text-base-content/50 ml-0.5 font-mono text-[9.5px] leading-none font-semibold"
          >+{{ extraDots }}</span
        >
      </span>
    </div>

    <div class="flex min-w-0 flex-1 flex-col justify-center py-1.5 pr-2">
      <span
        v-if="verse.comment"
        class="text-base-content/45 flex items-center gap-1 pb-0.5 text-[10.5px] font-semibold tracking-[0.12em] uppercase"
      >
        <IconComment class="size-3" />
        {{ verse.comment }}
      </span>
      <LyricsTextarea
        :model-value="verse.text"
        :data-lyrics-input="inputKey"
        :verse-styles="verseStyles"
        :placeholder="placeholder"
        @update:model-value="emit('update:text', $event)"
        @focus="emit('focus')"
      />
      <!-- Phone: the times go under the text, so they never cover it -->
      <span
        v-if="showTimes"
        class="text-base-content/40 flex items-center gap-1.5 px-1 font-mono text-[10.5px] leading-tight tabular-nums md:hidden"
        data-testid="verse-times-compact"
      >
        <span
          v-if="sounding"
          class="bg-primary size-1.5 shrink-0 animate-pulse rounded-full"
          aria-label="Sonando"
        />
        <span v-if="start" class="truncate">
          {{ start }}<template v-if="end"> → {{ end }}</template>
        </span>
        <i v-else class="text-base-content/35 font-sans">sin tiempo</i>
      </span>
    </div>

    <span
      v-if="showTimes"
      class="text-base-content/40 hidden shrink-0 items-center gap-1.5 pr-3 font-mono text-[11.5px] whitespace-nowrap tabular-nums md:flex"
      data-testid="verse-times"
    >
      <span
        v-if="sounding"
        class="bg-primary size-1.5 animate-pulse rounded-full"
        aria-label="Sonando"
      />
      <template v-if="start">
        {{ start }}<template v-if="end"> → {{ end }}</template>
      </template>
      <i v-else class="text-base-content/35 font-sans">sin tiempo</i>
    </span>
    <span
      v-else-if="sounding"
      class="bg-primary mr-3 size-1.5 shrink-0 animate-pulse self-center rounded-full"
      aria-label="Sonando"
    />
  </div>
</template>
