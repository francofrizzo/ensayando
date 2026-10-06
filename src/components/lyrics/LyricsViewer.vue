<script setup lang="ts">
import { computed, ref, watch } from "vue";

import { useLyricsColoring } from "@/composables/useLyricsColoring";
import type { CollectionWithRole, LyricStanza, LyricVerse } from "@/data/types";
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

const allLyricsWithStatus = computed(() => addStatusToLyrics(props.lyrics, props.currentTime));

const lyricsWithStatus = computed(() =>
  filterVisibleLyrics(allLyricsWithStatus.value, props.enabledTrackIds)
);

const regularizedLyrics = computed(() => regularizeLyrics(lyricsWithStatus.value));

const verseStyles = (verse: LyricVerse & { status?: "active" | "past" | "future" }) =>
  getVerseStyles(verse, props.collection, verse.status, "stage");

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
          'cursor-pointer': !isDisabled && line.start_time !== undefined,
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
            @click="
              () => !isDisabled && verse.start_time !== undefined && emit('seek', verse.start_time)
            "
          >
            <span
              v-if="verse.comment"
              class="text-base-content/45 text-center font-sans text-[11px] leading-none font-semibold tracking-[0.16em] uppercase"
              >{{ verse.comment }}</span
            >
            <div
              class="transition-[scale] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
              :class="{ 'scale-[1.14]': verse.status === 'active' }"
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
                :style="verseStyles(verse)"
                :class="verse.status === 'active' ? 'font-bold' : 'font-medium'"
                class="block text-center leading-tight text-balance uppercase transition-all duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                >{{ verse.text }}</span
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
