<script setup lang="ts">
import type { Track } from '@/data/song.types'
import { WaveSurferPlayer } from '@meersagor/wavesurfer-vue'
import ProgressSpinner from 'primevue/progressspinner'
import type WaveSurfer from 'wavesurfer.js'
import type { WaveSurferOptions } from 'wavesurfer.js'

type PartialWaveSurferOptions = Omit<WaveSurferOptions, 'container'>

const props = defineProps<{
  tracks: Track[]
  waveSurferOptions: PartialWaveSurferOptions
  isReady: boolean
  getWaveSurferColorScheme: (index: number) => any
}>()

const emit = defineEmits<{
  seek: [time: number]
  'wavesurfer-init': [index: number, ws: WaveSurfer]
  ready: [index: number, duration: number]
  timeupdate: [index: number, time: number]
}>()
</script>

<template>
  <div
    class="relative border border-surface-200 dark:border-surface-800 rounded-lg bg-surface-100 dark:bg-surface-900 md:m-3"
  >
    <div class="h-full overflow-y-auto">
      <div class="w-full h-full py-3 pl-3 md:pl-4">
        <div v-for="(track, index) in tracks" v-bind:key="index" class="flex items-start gap-6">
          <div class="w-full p-0">
            <WaveSurferPlayer
              :options="{
                ...waveSurferOptions,
                ...getWaveSurferColorScheme(index),
                url: track.file
              }"
              @interaction="(time: number) => emit('seek', time)"
              @waveSurfer="(ws: WaveSurfer) => emit('wavesurfer-init', index, ws)"
              @ready="(duration: number) => emit('ready', index, duration)"
              @timeupdate="(time: number) => emit('timeupdate', index, time)"
            />
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="!isReady"
      class="absolute top-0 left-0 bottom-0 right-0 z-10 bg-surface-200 dark:bg-surface-800 rounded opacity-80 flex flex-col gap-6 text-lg items-center justify-center"
    >
      <ProgressSpinner />
      <span class="text-muted uppercase text-muted-color tracking-wide">Cargando...</span>
    </div>
  </div>
</template>
