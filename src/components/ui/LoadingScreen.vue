<script setup lang="ts">
import LoadingWaveform from "@/components/ui/LoadingWaveform.vue";
</script>

<template>
  <div
    class="text-base-content/50 flex h-dvh w-full flex-col items-center justify-center gap-6 p-2 text-lg select-none"
  >
    <LoadingWaveform size="lg" :bar-count="24" />
    <span class="tracking-wide uppercase">Cargando...</span>
  </div>
</template>
