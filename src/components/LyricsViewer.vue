<script setup lang="ts">
import type { Collection, LyricStanza, LyricVerse } from "@/data/types";
import { computed, ref, watch } from "vue";

const props = defineProps<{
  collection: Collection;
  lyrics: LyricStanza[];
  currentTime: number;
  isDisabled: boolean;
  enabledTrackIds: number[];
}>();

const emit = defineEmits<{
  seek: [time: number];
}>();

type LyricVerseStatus = "active" | "past" | "future";
type LyricVerseWithStatus = LyricVerse & { status: LyricVerseStatus };
type LyricStanzaWithStatus = (LyricVerseWithStatus | LyricVerseWithStatus[][])[];

type RegularizedLyricLine = {
  columns: LyricVerseWithStatus[][];
  start_time?: number;
  end_time?: number;
};
type RegularizedLyricStanza = RegularizedLyricLine[];

const getVerseStyles = (lyric: LyricVerseWithStatus) => {
  const defaultColor = props.collection.main_color;
  let color: string | undefined;
  let gradientColors: string[] = [];

  if (lyric.status === "past") {
    color = `var(--color-zinc-400)`;
  } else {
    const { track_colors: trackColors } = props.collection;
    if (lyric.color_keys && lyric.color_keys.length > 1) {
      gradientColors = lyric.color_keys.map((colorKey) => trackColors[colorKey] ?? defaultColor);
    } else if (lyric.color_keys && lyric.color_keys.length === 1) {
      color = trackColors[lyric.color_keys[0]!];
    } else {
      color = defaultColor;
    }
  }

  color = color ?? gradientColors[0] ?? defaultColor;
  gradientColors = gradientColors.length > 0 ? gradientColors : [color, color];
  return {
    color,
    "background-image": `linear-gradient(to right, ${gradientColors.join(", ")})`,
    "-webkit-background-clip": "text",
    "-webkit-text-fill-color": "transparent",
    "background-clip": "text"
  };
};

const isVerseVisible = (verse: LyricVerse) => {
  return (
    !verse.audio_track_ids ||
    verse.audio_track_ids.some((trackId) => props.enabledTrackIds.includes(trackId))
  );
};

const getItemStartTime = (
  item: LyricVerse | LyricVerseWithStatus | LyricVerse[][] | LyricVerseWithStatus[][]
) => {
  if (Array.isArray(item)) {
    return Math.min(
      ...item
        .flatMap((column) => column.map((verse) => verse.start_time))
        .filter((time) => time !== undefined)
    );
  }
  return item.start_time;
};

const visibleLyrics = computed((): LyricStanza[] =>
  props.lyrics
    .map((stanza) => {
      const filtered = stanza
        .filter((item) => {
          if (Array.isArray(item)) {
            // Multi-column lyric array
            return item.some((column) => column.some(isVerseVisible));
          }
          // Single verse
          return isVerseVisible(item);
        })
        .map((item) => {
          if (Array.isArray(item)) {
            // Multi-column lyric array
            return item
              .map((column) => column.filter(isVerseVisible))
              .filter((column) => column.length > 0);
          }
          // Single verse
          return item;
        });
      return filtered.length > 0 ? filtered : [];
    })
    .filter((group) => group.length > 0)
);

const addStatusToVerse = (
  verse: LyricVerse,
  nextVerseStartTime: number | undefined
): LyricVerseWithStatus => {
  let status: LyricVerseStatus = "future";

  let endTime: number | undefined = undefined;
  if (verse.start_time) {
    endTime = verse.end_time ?? (nextVerseStartTime ? nextVerseStartTime : verse.start_time + 5);
    if (props.currentTime >= verse.start_time) {
      status = props.currentTime < endTime ? "active" : "past";
    }
  }

  return {
    ...verse,
    end_time: endTime,
    status
  };
};

const lyricsWithStatus = computed(() =>
  visibleLyrics.value.map((stanza, stanzaIndex): LyricStanzaWithStatus => {
    const nextStanza = visibleLyrics.value[stanzaIndex + 1];
    return stanza.map((item, itemIndex) => {
      if (Array.isArray(item)) {
        return item.map((column) =>
          column.map((verse, verseIndex) => {
            const nextItem = column[verseIndex + 1] ?? stanza[stanzaIndex + 1] ?? nextStanza?.[0];
            const nextLyricStartTime = nextItem ? getItemStartTime(nextItem) : undefined;
            return addStatusToVerse(verse, nextLyricStartTime);
          })
        );
      } else {
        const nextLyricItem = stanza[itemIndex + 1] ?? nextStanza?.[0];
        const nextLyricStartTime = nextLyricItem ? getItemStartTime(nextLyricItem) : undefined;
        return addStatusToVerse(item, nextLyricStartTime);
      }
    });
  })
);

const OVERLAP_THRESHOLD = 0.4;

// Calculate how much of verse2 overlaps with verse1. Example:
// start1 [       |xxxxxx] end1
//         start2 [xxxxxx|----] end2 -> 6/10 = 0.6 overlap
const calculateOverlap = (start1: number, end1: number, start2: number, end2: number) => {
  const overlapStart = Math.max(start1, start2);
  const overlapEnd = Math.min(end1, end2);
  const overlappingLength = Math.max(0, overlapEnd - overlapStart);
  const totalLength = end2 - start2;

  return totalLength > 0 ? overlappingLength / totalLength : 0;
};

const regularizedLyrics = computed(() =>
  lyricsWithStatus.value.map((stanza): RegularizedLyricStanza => {
    const lines: RegularizedLyricLine[] = [];
    for (const item of stanza) {
      if (Array.isArray(item)) {
        const startTimes = item
          .flatMap((col) => col.map((verse) => verse.start_time))
          .filter((time) => time !== undefined);
        const endTimes = item
          .flatMap((col) => col.map((verse) => verse.end_time))
          .filter((time) => time !== undefined);
        lines.push({
          start_time: Math.min(...startTimes),
          end_time: Math.max(...endTimes),
          columns: item
        });
      } else {
        const previousLine = lines[lines.length - 1];
        if (
          previousLine &&
          item.start_time &&
          item.end_time &&
          previousLine.start_time &&
          previousLine.end_time
        ) {
          const overlap = calculateOverlap(
            item.start_time,
            item.end_time,
            previousLine.start_time,
            previousLine.end_time
          );
          if (overlap > OVERLAP_THRESHOLD) {
            previousLine.columns.push([item]);
            previousLine.end_time = Math.max(previousLine.end_time, item.end_time);
            continue;
          }
        }
        lines.push({
          start_time: item.start_time,
          end_time: item.end_time,
          columns: [[item]]
        });
      }
    }
    return lines;
  })
);

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
  <div class="flex flex-col gap-6 text-xl">
    <div
      v-for="(stanza, stanzaIndex) in regularizedLyrics"
      :key="stanzaIndex"
      class="flex flex-col gap-2"
    >
      <div
        v-for="(line, lineIndex) in stanza"
        :key="`${stanzaIndex}-${lineIndex}`"
        class="flex flex-row items-center justify-evenly gap-10"
        :class="{
          'cursor-pointer': !isDisabled && line.start_time,
          'cursor-default': isDisabled
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
            class="flex flex-col items-center text-left gap-1.5"
            @click="() => !isDisabled && verse.start_time && emit('seek', verse.start_time)"
          >
            <span
              v-if="verse.comment"
              class="text-sm text-base-content/40 uppercase tracking-wide text-center"
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
              :style="getVerseStyles(verse)"
              :class="{
                'text-primary': verse.status === 'active',
                'font-semibold': verse.status === 'active',
                'scale-[1.2]': verse.status === 'active'
              }"
              class="transition-all transition-duration-500 uppercase tracking-wide text-center"
              >{{ verse.text }}</span
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
