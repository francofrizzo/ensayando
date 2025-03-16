<script setup lang="ts">
import { type ComponentPublicInstance, computed, ref, watch } from 'vue'

const props = defineProps<{
  lyrics: {
    startTime: number
    endTime?: number
    spaceBefore?: boolean
    text: string
  }[]
  currentTime: number
  isDisabled: boolean
}>()

const lyricsWithStatus = computed(() =>
  props.lyrics.map((lyric, index) => {
    const nextLyric = props.lyrics[index + 1]
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
  <ul class="list-none w-full text-center text-xl px-0 py-8">
    <li
      v-for="lyric in lyricsWithStatus"
      :key="lyric.startTime"
      class="pt-1 pb-1"
      :class="{
        'cursor-pointer': !isDisabled,
        'cursor-default': isDisabled,
        'pt-4': lyric.spaceBefore
      }"
      @click="() => !isDisabled && $emit('seek', lyric.startTime)"
    >
      <span
        :class="{
          'text-primary': lyric.status === 'active',
          'font-semibold': lyric.status === 'active',
          'text-surface-400': lyric.status === 'past',
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
    </li>
  </ul>
</template>
