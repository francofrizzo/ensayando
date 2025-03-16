<script setup lang="ts">
import type { Lyric } from '@/data/song.types'
import type { Collection } from '@/data/collection.types'
import { type ComponentPublicInstance, computed, ref, watch } from 'vue'

const props = defineProps<{
  lyrics: Lyric[][]
  currentTime: number
  isDisabled: boolean
  collection: Collection
  enabledTracks: string[]
}>()

type LyricStatus = 'active' | 'past' | 'future'
type LyricWithStatus = Lyric & { endTime: number; status: LyricStatus }
type LyricLine = {
  startTime: number
  endTime: number
  columns: LyricWithStatus[]
}

const getLyricStyles = (lyric: LyricWithStatus) => {
  if (lyric.status === 'past') {
    return {
      color: 'var(--p-surface-400)',
      backgroundImage: 'linear-gradient(to right, var(--p-surface-400), var(--p-surface-400))',
      '-webkit-background-clip': 'text',
      '-webkit-text-fill-color': 'transparent',
      'background-clip': 'text'
    }
  }

  const shade = lyric.status === 'active' ? '500' : '600'

  const { trackColors } = props.collection.theme
  if (!trackColors || Array.isArray(trackColors) || typeof trackColors !== 'object') {
    return { color: `var(--p-primary-${shade})` }
  }

  // If there are multiple tracks, create a linear gradient
  if (lyric.tracks && lyric.tracks.length > 1) {
    const colors = lyric.tracks.map((track) =>
      trackColors[track] ? `var(--p-${trackColors[track]}-${shade})` : `var(--p-primary-${shade})`
    )
    const gradient = `linear-gradient(to right, ${colors.join(', ')})`
    return {
      'background-image': gradient,
      '-webkit-background-clip': 'text',
      '-webkit-text-fill-color': 'transparent',
      'background-clip': 'text'
    }
  }

  const firstTrack = lyric.tracks?.[0]
  if (!firstTrack || !trackColors[firstTrack]) {
    return { color: `var(--p-primary-${shade})` }
  }

  return { color: `var(--p-${trackColors[firstTrack]}-${shade})` }
}
const enabledLyrics = computed(() =>
  props.lyrics.map((lyricGroup) => {
    const filtered = lyricGroup.filter((lyric) => ((!lyric.tracks) || lyric.tracks?.some(track => props.enabledTracks.includes(track))) ?? false)
    return filtered.length > 0 ? filtered : []
  }).filter(group => group.length > 0)
)

const lyricsWithStatus = computed(() =>
  enabledLyrics.value.map((lyricGroup, index): LyricWithStatus[] => {
    const nextGroup = enabledLyrics.value[index + 1]
    return lyricGroup.map((lyric, index): LyricWithStatus => {
      const nextLyric = lyricGroup[index + 1] ?? nextGroup?.[0]
      const endTime = lyric.endTime ?? (nextLyric ? nextLyric.startTime : lyric.startTime + 5)
      return {
        ...lyric,
        endTime,
        status:
          props.currentTime >= lyric.startTime
            ? props.currentTime < endTime
              ? 'active'
              : 'past'
            : 'future'
      }
    })
  })
)

const OVERLAP_THRESHOLD = 0.5

const calculateOverlap = (lyric1: LyricWithStatus, lyric2: LyricWithStatus) => {
  const start = Math.max(lyric1.startTime, lyric2.startTime)
  const end = Math.min(lyric1.endTime, lyric2.endTime)
  if (end <= start) return 0 // No overlap

  const overlap = end - start
  const duration1 = lyric1.endTime - lyric1.startTime
  const duration2 = lyric2.endTime - lyric2.startTime
  
  // Return the overlap percentage relative to the shorter duration
  return overlap / Math.min(duration1, duration2)
}

const lyricsInColumns = computed(() =>
  lyricsWithStatus.value.map((lyricGroup): LyricLine[] => {
    const lines: LyricLine[] = []

    for (const lyric of lyricGroup) {
      // Check if the current lyric overlaps significantly with the last line
      const lastLine = lines[lines.length - 1]
      if (lastLine) {
        // Check overlap with all lyrics in the last line
        const hasSignificantOverlap = lastLine.columns.some(
          existingLyric => calculateOverlap(existingLyric, lyric) >= OVERLAP_THRESHOLD
        )

        if (hasSignificantOverlap) {
          lastLine.columns.push(lyric)
          lastLine.endTime = Math.max(lastLine.endTime, lyric.endTime)
          continue
        }
      }

      // If no significant overlap or first line, create a new line
      lines.push({ startTime: lyric.startTime, endTime: lyric.endTime, columns: [lyric] })
    }

    return lines
  })
)

const currentLyric = ref<Element | ComponentPublicInstance | null>(null)

watch(
  () => currentLyric.value,
  (current, prev) => {
    if (current && current instanceof Element) {
      current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }
  }
)
</script>

<template>
  <div class="py-8 flex flex-col gap-6 text-xl">
    <div
      v-for="(lyricGroup, index) in lyricsInColumns"
      :key="index"
      class="flex flex-col gap-2"
    >
      <div
        v-for="lyricLine in lyricGroup"
        :key="lyricLine.startTime"
        class="flex flex-row items-center justify-evenly gap-4"
        :class="{
          'cursor-pointer': !isDisabled,
          'cursor-default': isDisabled,
        }"
      >
        <div
          v-for="lyric in lyricLine.columns"
          :key="lyric.startTime"
          class="flex flex-col items-center"
          @click="() => !isDisabled && $emit('seek', lyricLine.startTime)"
        >
          <span
            v-if="lyric.comment"
            class="text-sm text-surface-500 uppercase tracking-wide mb-1 text-center"
            >{{ lyric.comment }}</span
          >
          <span
            :style="getLyricStyles(lyric)"
            :class="{
              'text-primary': lyric.status === 'active',
              'font-semibold': lyric.status === 'active',
              'text-2xl': lyric.status === 'active'
            }"
            class="transition-all transition-duration-500 uppercase tracking-wide text-center"
            :ref="
              (el) => {
                if (lyric.status === 'active') {
                  currentLyric = el
                }
              }
            "
            >{{ lyric.text }}</span
          >
        </div>
      </div>
    </div>
  </div>
</template>
