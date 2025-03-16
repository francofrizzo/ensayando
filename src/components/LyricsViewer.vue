<script setup lang="ts">
import type { Lyric } from '@/data/song.types'
import type { Collection } from '@/data/collection.types'
import { type ComponentPublicInstance, computed, ref, watch } from 'vue'

const props = defineProps<{
  lyrics: Lyric[][]
  currentTime: number
  isDisabled: boolean
  collection: Collection
}>()

type LyricStatus = 'active' | 'past' | 'future'
type LyricWithStatus = Lyric & { endTime: number; status: LyricStatus }

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

const lyricsWithStatus = computed(() =>
  props.lyrics.map((lyricGroup, index): LyricWithStatus[] => {
    const nextGroup = props.lyrics[index + 1]
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
      v-for="(lyricGroup, index) in lyricsWithStatus"
      :key="index"
      class="flex flex-col gap-1 text-center"
    >
      <div
        v-for="lyric in lyricGroup"
        :key="lyric.startTime"
        class="pt-1 pb-1"
        :class="{
          'cursor-pointer': !isDisabled,
          'cursor-default': isDisabled,
          'flex flex-col items-center': true
        }"
        @click="() => !isDisabled && $emit('seek', lyric.startTime)"
      >
        <span v-if="lyric.comment" class="text-sm text-surface-500 uppercase tracking-wide mb-3">{{ lyric.comment }}</span>
        <span
          :style="getLyricStyles(lyric)"
          :class="{
            'text-primary': lyric.status === 'active',
            'font-semibold': lyric.status === 'active',
            'text-2xl': lyric.status === 'active'
          }"
          class="transition-all transition-duration-500 uppercase tracking-wide"
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
</template>
