<script setup lang="ts">
import { computed, ref, watch } from "vue";

import { useLyricsColoring } from "@/composables/useLyricsColoring";
import type { MyPartState } from "@/composables/usePlayerState";
import { useTheme } from "@/composables/useTheme";
import type { CollectionWithRole, LyricStanza, LyricVerse } from "@/data/types";
import {
  addStatusToLyrics,
  filterVisibleLyrics,
  regularizeLyrics
} from "@/utils/lyricsViewerUtils";
import { isVerseDimmed } from "@/utils/myPart";

const props = defineProps<{
  collection: CollectionWithRole;
  lyrics: LyricStanza[];
  currentTime: number;
  isDisabled: boolean;
  enabledTrackIds: number[];
  /** "Mi parte": verses of other tracks are dimmed. */
  myPart?: MyPartState | null;
}>();

const emit = defineEmits<{
  seek: [time: number];
}>();

const { getVerseStyles } = useLyricsColoring();
const { resolvedTheme } = useTheme();

const allLyricsWithStatus = computed(() => addStatusToLyrics(props.lyrics, props.currentTime));

const lyricsWithStatus = computed(() =>
  filterVisibleLyrics(allLyricsWithStatus.value, props.enabledTrackIds)
);

const regularizedLyrics = computed(() => regularizeLyrics(lyricsWithStatus.value));

// The active verse emits its color, only in dark (on a light stage a glow reads as blur).
// drop-shadow instead of text-shadow: the text is a gradient clipped to the glyphs.
// Verses near the playhead keep the same drop-shadow and only its strength changes,
// so the glow fades in and out with the verse's transition instead of popping. The
// rest carry no filter at all: a filter on every line is costly while scrolling.
const GLOW_WINDOW = 1.5; // seconds before a verse starts and after it ends
const verseStyles = (verse: LyricVerse & { status?: "active" | "past" | "future" }) => {
  const styles: Record<string, string | undefined> = {
    ...getVerseStyles(verse, props.collection, verse.status)
  };
  if (resolvedTheme.value !== "dark") return styles;

  const glows = verse.status === "active";
  const t = props.currentTime;
  const nearStart = verse.start_time !== undefined && Math.abs(verse.start_time - t) < GLOW_WINDOW;
  const nearEnd = verse.end_time !== undefined && Math.abs(t - verse.end_time) < GLOW_WINDOW;
  if (glows || nearStart || nearEnd) {
    const glowColor = styles.color ?? "currentColor";
    styles.filter = `drop-shadow(0 0 16px color-mix(in oklch, ${glowColor} ${glows ? 55 : 0}%, transparent))`;
  }
  return styles;
};

const currentVerseElement = ref<Element | null>(null);

watch(
  () => currentVerseElement.value,
  (current) => {
    if (current) {
      current.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }
  }
);
</script>

<template>
  <div class="font-lyrics flex flex-col gap-7 md:gap-8">
    <div
      v-for="(stanza, stanzaIndex) in regularizedLyrics"
      :key="stanzaIndex"
      class="flex flex-col gap-2.5 md:gap-3"
    >
      <div
        v-for="(line, lineIndex) in stanza"
        :key="`${stanzaIndex}-${lineIndex}`"
        class="flex flex-row items-center justify-evenly"
        :class="{
          'cursor-pointer': !isDisabled && line.start_time,
          'cursor-default': isDisabled,
          'gap-10 px-6 text-xl tracking-[0.02em] md:px-10': line.columns.length < 3,
          'gap-4 px-4 text-base tracking-tight sm:gap-6 sm:px-6 sm:tracking-normal md:px-10 md:text-xl md:tracking-[0.02em]':
            line.columns.length >= 3,
          'text-sm sm:text-base': line.columns.length >= 4
        }"
      >
        <div
          v-for="(column, columnIndex) in line.columns"
          :key="`${stanzaIndex}-${lineIndex}-${columnIndex}`"
          class="flex flex-col items-center gap-2"
        >
          <div
            v-for="(verse, verseIndex) in column"
            :key="`${stanzaIndex}-${lineIndex}-${columnIndex}-${verseIndex}`"
            class="flex snap-center flex-col items-center gap-2 text-left"
            @click="() => !isDisabled && verse.start_time && emit('seek', verse.start_time)"
          >
            <span
              v-if="verse.comment"
              class="text-base-content/45 text-center font-sans text-[11px] leading-none font-semibold tracking-[0.16em] uppercase"
              >{{ verse.comment }}</span
            >
            <span
              :ref="
                (el: any) => {
                  if (verse.status === 'active') {
                    currentVerseElement = el;
                  }
                }
              "
              :data-active="verse.status === 'active' || undefined"
              :data-dimmed="(myPart && isVerseDimmed(verse, myPart)) || undefined"
              :style="verseStyles(verse)"
              :class="{
                'scale-[1.14] font-bold': verse.status === 'active',
                'font-medium': verse.status !== 'active',
                'opacity-[0.32]': myPart && isVerseDimmed(verse, myPart)
              }"
              class="text-center leading-tight text-balance uppercase transition-all duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
              >{{ verse.text }}</span
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
