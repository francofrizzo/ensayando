<script setup lang="ts">
import type { Collection } from '@/data/collection.types'
import type { Lyric, LyricGroup, LyricGroupItem } from '@/data/song.types'
import { type ComponentPublicInstance, computed, ref, watch } from 'vue'

const props = defineProps<{
  lyrics: LyricGroup[]
  currentTime: number
  isDisabled: boolean
  collection: Collection
  tracks: Record<string, boolean>
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

  const visualTracks = lyric.visualTracks ?? lyric.tracks

  // If there are multiple tracks, create a linear gradient
  if (visualTracks && visualTracks.length > 1) {
    const colors = visualTracks.map((track) =>
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

  const firstTrack = visualTracks?.[0]
  if (!firstTrack || !trackColors[firstTrack]) {
    return { color: `var(--p-primary-${shade})` }
  }

  return { color: `var(--p-${trackColors[firstTrack]}-${shade})` }
}

const isLyricVisible = (lyric: Lyric) => {
  return (
    !lyric.tracks || lyric.tracks.some((track) => props.tracks[track] || props.tracks === undefined)
  )
}

const visibleLyrics = computed((): LyricGroup[] =>
  props.lyrics
    .map((lyricGroup) => {
      const filtered = lyricGroup
        .filter((item: LyricGroupItem) => {
          if (Array.isArray(item)) {
            // This is a LyricColumn[] (array of Lyric arrays)
            return item.some((column) => column.some(isLyricVisible))
          }
          // This is a Lyric
          return isLyricVisible(item)
        })
        .map((item: LyricGroupItem) => {
          if (Array.isArray(item)) {
            // This is a LyricColumn[] (array of Lyric arrays)
            return item
              .map((column) => column.filter(isLyricVisible))
              .filter((column) => column.length > 0)
          }
          return item
        })
      return filtered.length > 0 ? filtered : []
    })
    .filter((group) => group.length > 0)
)

const addStatusToLyric = (lyric: Lyric, nextLyricStartTime: number | undefined) => {
  const endTime = lyric.endTime ?? (nextLyricStartTime ? nextLyricStartTime : lyric.startTime + 5)
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
  visibleLyrics.value.map((lyricGroup, groupIndex): (LyricWithStatus | LyricWithStatus[][])[] => {
    const nextGroup = visibleLyrics.value[groupIndex + 1]
    return lyricGroup.map((lyricOrColumn, itemIndex): LyricWithStatus | LyricWithStatus[][] => {
      if (Array.isArray(lyricOrColumn)) {
        // Handle columns of lyrics
        return lyricOrColumn.map((column) =>
          column.map((lyric, indexInColumn) => {
            const nextLyricItem = column[indexInColumn + 1] ?? nextGroup?.[0]
            const nextLyricStartTime = Array.isArray(nextLyricItem)
              ? Math.min(...nextLyricItem.map((column) => column[0].startTime))
              : nextLyricItem?.startTime
            return addStatusToLyric(lyric, nextLyricStartTime)
          })
        )
      } else {
        // Handle single lyric
        const nextLyricItem = lyricGroup[itemIndex + 1] ?? nextGroup?.[0]
        const nextLyricStartTime = Array.isArray(nextLyricItem)
          ? Math.min(...nextLyricItem.map((column) => column[0].startTime))
          : nextLyricItem?.startTime
        return addStatusToLyric(lyricOrColumn, nextLyricStartTime)
      }
    })
  })
)

const OVERLAP_THRESHOLD = 0.4

// Calculate how much of lyric2 overlaps with lyric1. Example:
// start1 [       |xxxxxx] end1
//         start2 [xxxxxx|----] end2 -> 6/10 = 0.6 overlap
const calculateOverlap = (start1: number, end1: number, start2: number, end2: number) => {
  const overlapStart = Math.max(start1, start2)
  const overlapEnd = Math.min(end1, end2)
  const overlappingLength = Math.max(0, overlapEnd - overlapStart)
  const totalLength = end2 - start2

  return totalLength > 0 ? overlappingLength / totalLength : 0
}

const lyricsInColumns = computed(() =>
  lyricsWithStatus.value.map((lyricGroup): LyricLine[] => {
    const lines: LyricLine[] = []

    for (const lyricOrColumn of lyricGroup) {
      if (Array.isArray(lyricOrColumn)) {
        // This is an array of columns, each containing an array of lyrics
        const columns = lyricOrColumn
        const startTimes = columns.flatMap((col) => col.map((lyric) => lyric.startTime))
        const endTimes = columns.flatMap((col) => col.map((lyric) => lyric.endTime))

        lines.push({
          startTime: Math.min(...startTimes),
          endTime: Math.max(...endTimes),
          columns: columns
        })
      } else {
        // This is a single lyric
        const previousLine = lines[lines.length - 1]
        if (previousLine) {
          const overlap = calculateOverlap(
            lyricOrColumn.startTime,
            lyricOrColumn.endTime,
            previousLine.startTime,
            previousLine.endTime
          )
          if (overlap > OVERLAP_THRESHOLD) {
            previousLine.columns.push([lyricOrColumn])
            previousLine.endTime = Math.max(previousLine.endTime, lyricOrColumn.endTime)
          } else {
            lines.push({
              startTime: lyricOrColumn.startTime,
              endTime: lyricOrColumn.endTime,
              columns: [[lyricOrColumn]]
            })
          }
        } else {
          lines.push({
            startTime: lyricOrColumn.startTime,
            endTime: lyricOrColumn.endTime,
            columns: [[lyricOrColumn]]
          })
        }
      }
    }

    return lines
  })
)

const currentLyric = ref<Element | ComponentPublicInstance | null>(null)

watch(
  () => currentLyric.value,
  (current) => {
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
        class="flex flex-row items-center justify-evenly gap-10"
        :class="{
          'cursor-pointer': !isDisabled && lyricLine.startTime,
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
            class="flex flex-col items-center text-left gap-1.5"
            @click="() => !isDisabled && lyric.startTime && emit('seek', lyric.startTime)"
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
