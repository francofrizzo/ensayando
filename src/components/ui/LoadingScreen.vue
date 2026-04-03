<script setup lang="ts">
import LoadingWaveform from "@/components/ui/LoadingWaveform.vue";
</script>

<template>
  <div
    class="bg-base-200 text-base-content/35 flex h-dvh w-full flex-col items-center justify-center p-2 text-lg select-none"
  >
    <div
      class="flex flex-col items-center gap-6"
      style="animation: pulse-subtle 3s ease-in-out infinite"
    >
      <LoadingWaveform size="lg" :bar-count="14" />
      <span class="tracking-wide">Cargando...</span>
    </div>
  </div>
</template>
