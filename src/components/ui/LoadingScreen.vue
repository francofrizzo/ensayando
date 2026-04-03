<script setup lang="ts">
import LoadingWaveform from "@/components/ui/LoadingWaveform.vue";
</script>

<template>
  <div
    class="bg-base-200 text-base-content/50 flex h-dvh w-full flex-col items-center justify-center gap-6 p-2 text-lg select-none"
  >
    <LoadingWaveform size="lg" :bar-count="14" />
    <span class="animate-pulse tracking-wide" style="animation-duration: 3s">Cargando...</span>
  </div>
</template>
