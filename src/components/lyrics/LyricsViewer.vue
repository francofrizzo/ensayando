<script setup lang="ts">
import { computed, ref, watch } from "vue";

import { useLyricsColoring } from "@/composables/useLyricsColoring";
import type { CollectionWithRole, LyricStanza } from "@/data/types";
import {
  addStatusToLyrics,
  filterVisibleLyrics,
  regularizeLyrics
} from "@/utils/lyricsViewerUtils";

const props = defineProps<{
  collection: CollectionWithRole;
  lyrics: LyricStanza[];
  currentTime: number;
  isDisabled: boolean;
  enabledTrackIds: number[];
}>();

const emit = defineEmits<{
  seek: [time: number];
}>();

const { getVerseStyles } = useLyricsColoring();

const allLyricsWithStatus = computed(() =>
  addStatusToLyrics(props.lyrics, props.currentTime)
);

const lyricsWithStatus = computed(() =>
  filterVisibleLyrics(allLyricsWithStatus.value, props.enabledTrackIds)
);

const regularizedLyrics = computed(() =>
  regularizeLyrics(lyricsWithStatus.value)
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
  <div class="font-lyrics flex flex-col gap-6">
    <div
      v-for="(stanza, stanzaIndex) in regularizedLyrics"
      :key="stanzaIndex"
      class="flex flex-col gap-2"
    >
      <div
        v-for="(line, lineIndex) in stanza"
        :key="`${stanzaIndex}-${lineIndex}`"
        class="flex flex-row items-center justify-evenly"
        :class="{
          'cursor-pointer': !isDisabled && line.start_time,
          'cursor-default': isDisabled,
          'gap-10 px-10 text-xl tracking-wide': line.columns.length < 3,
          'gap-4 px-4 text-base tracking-tight sm:gap-6 sm:px-6 sm:tracking-normal md:px-10 md:text-xl md:tracking-wide':
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
            class="flex snap-center flex-col items-center gap-1.5 text-left"
            @click="() => !isDisabled && verse.start_time && emit('seek', verse.start_time)"
          >
            <span v-if="verse.comment" class="text-base-content/40 text-center text-sm uppercase">{{
              verse.comment
            }}</span>
            <span
              :ref="
                (el: any) => {
                  if (verse.status === 'active') {
                    currentVerseElement = el;
                  }
                }
              "
              :style="getVerseStyles(verse, collection, verse.status)"
              :class="{
                'font-semibold': verse.status === 'active',
                'scale-[1.15]': verse.status === 'active',
                'dark:drop-shadow-md': verse.status === 'active',
                'dark:drop-shadow-none': verse.status !== 'active'
              }"
              class="text-center uppercase drop-shadow-xs transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]"
              >{{ verse.text }}</span
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
