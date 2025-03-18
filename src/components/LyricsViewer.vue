<script setup lang="ts">
import type { Collection } from '@/data/collection.types'
import type { Lyric, LyricGroup, LyricGroupItem } from '@/data/song.types'
import { type ComponentPublicInstance, computed, ref, watch } from 'vue'

const props = defineProps<{
  lyrics: LyricGroup[]
  currentTime: number
  isDisabled: boolean
  collection: Collection
  enabledTracks: string[]
}>()

const emit = defineEmits<{
  seek: [time: number]
}>()

type LyricStatus = 'active' | 'past' | 'future'
type LyricWithStatus = Lyric & { endTime: number; status: LyricStatus }

type LyricLine = {
  startTime: number
  endTime: number
  columns: LyricWithStatus[][]
}

const getLyricStyles = (lyric: LyricWithStatus) => {
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches

  if (lyric.status === 'past') {
    return {
      color: 'var(--p-surface-400)',
      backgroundImage: 'linear-gradient(to right, var(--p-surface-400), var(--p-surface-400))',
      '-webkit-background-clip': 'text',
      '-webkit-text-fill-color': 'transparent',
      'background-clip': 'text'
    }
  }

  const shade = lyric.status === 'active' ? '500' : isDarkMode ? '600' : '400'

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

const isLyricEnabled = (lyric: Lyric) => {
  return !lyric.tracks || lyric.tracks.some((track) => props.enabledTracks.includes(track))
}

const enabledLyrics = computed(() =>
  props.lyrics
    .map((lyricGroup) => {
      const filtered = lyricGroup
        .filter((item: LyricGroupItem) => {
          if (Array.isArray(item)) {
            // This is a LyricColumn[] (array of Lyric arrays)
            return item.some((column) => column.some(isLyricEnabled))
          }
          // This is a Lyric
          return isLyricEnabled(item)
        })
        .map((item: LyricGroupItem) => {
          if (Array.isArray(item)) {
            // This is a LyricColumn[] (array of Lyric arrays)
            return item
              .map((column) => column.filter(isLyricEnabled))
              .filter((column) => column.length > 0)
          }
          return item
        })
      return filtered.length > 0 ? filtered : []
    })
    .filter((group) => group.length > 0)
)

const addStatusToLyric = (lyric: Lyric, nextLyric: Lyric | undefined) => {
  const endTime = lyric.endTime ?? (nextLyric ? nextLyric.startTime : lyric.startTime + 5)
  let status: LyricStatus = 'future'

  if (props.currentTime >= lyric.startTime) {
    status = props.currentTime < endTime ? 'active' : 'past'
  }

  return {
    ...lyric,
    endTime,
    status
  }
}

const lyricsWithStatus = computed(() =>
  enabledLyrics.value.map((lyricGroup, groupIndex): (LyricWithStatus | LyricWithStatus[][])[] => {
    const nextGroup = enabledLyrics.value[groupIndex + 1]
    return lyricGroup.map((lyricOrColumn, itemIndex): LyricWithStatus | LyricWithStatus[][] => {
      if (Array.isArray(lyricOrColumn)) {
        // Handle columns of lyrics
        return lyricOrColumn.map((column) =>
          column.map((lyric, indexInColumn) => {
            const nextLyric = column[indexInColumn + 1]
            return addStatusToLyric(lyric, nextLyric)
          })
        ) as LyricWithStatus[][]
      } else {
        // Handle single lyric
        const nextLyric = lyricGroup[itemIndex + 1] ?? nextGroup?.[0]
        return addStatusToLyric(lyricOrColumn, nextLyric as Lyric | undefined)
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

    for (const lyricOrColumn of lyricGroup) {
      if (Array.isArray(lyricOrColumn)) {
        // This is an array of columns, each containing an array of lyrics
        const columns = lyricOrColumn as LyricWithStatus[][]
        const startTimes = columns.flatMap((col) => col.map((lyric) => lyric.startTime))
        const endTimes = columns.flatMap((col) => col.map((lyric) => lyric.endTime))

        lines.push({
          startTime: Math.min(...startTimes),
          endTime: Math.max(...endTimes),
          columns: columns
        })
      } else {
        // Handle single lyric
        const lyric = lyricOrColumn

        // Check if the current lyric overlaps significantly with the last line
        const lastLine = lines[lines.length - 1]
        if (lastLine) {
          // Check overlap with all lyrics in the last line
          const hasSignificantOverlap = lastLine.columns.some((column) =>
            column.some(
              (existingLyric) => calculateOverlap(existingLyric, lyric) >= OVERLAP_THRESHOLD
            )
          )

          if (hasSignificantOverlap) {
            lastLine.columns.push([lyric]) // Add as new column
            lastLine.endTime = Math.max(lastLine.endTime, lyric.endTime)
            continue
          }
        }

        // If no significant overlap or first line, create a new line
        lines.push({
          startTime: lyric.startTime,
          endTime: lyric.endTime,
          columns: [[lyric]] // Double wrap to match expected type
        })
      }
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
    <div v-for="(lyricGroup, index) in lyricsInColumns" :key="index" class="flex flex-col gap-2.5">
      <div
        v-for="lyricLine in lyricGroup"
        :key="lyricLine.startTime"
        class="flex flex-row items-center justify-evenly gap-4"
        :class="{
          'cursor-pointer': !isDisabled,
          'cursor-default': isDisabled
        }"
      >
        <div
          v-for="(column, columnIndex) in lyricLine.columns"
          :key="columnIndex"
          class="flex flex-col items-center gap-2.5"
        >
          <div
            v-for="(lyric, lyricIndex) in column"
            :key="lyricIndex"
            class="flex flex-col text-left gap-1.5"
            @click="() => !isDisabled && emit('seek', lyric.startTime)"
          >
            <span
              v-if="lyric.comment"
              class="text-sm text-surface-500 uppercase tracking-wide text-center"
              >{{ lyric.comment }}</span
            >
            <span
              :style="getLyricStyles(lyric)"
              :class="{
                'text-primary': lyric.status === 'active',
                'font-semibold': lyric.status === 'active',
                'scale-[1.2]': lyric.status === 'active'
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
  </div>
</template>
