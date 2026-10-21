<script setup lang="ts">
import type { SilenceSkip } from "@/utils/silence-skips";

defineProps<{ intervals: SilenceSkip[]; duration: number }>();
</script>

<template>
  <div class="pointer-events-none absolute inset-0" aria-hidden="true">
    <span
      v-for="interval in intervals.filter((item) => duration > 0 && item.start < duration)"
      :key="interval.start"
      class="silence-region text-base-content/25 absolute inset-y-0 border-x border-current"
      :style="{
        left: `${(100 * interval.start) / duration}%`,
        width: `${(100 * (Math.min(interval.end, duration) - interval.start)) / duration}%`
      }"
      data-testid="silence-region"
    />
  </div>
</template>

<style scoped>
.silence-region {
  background: repeating-linear-gradient(135deg, transparent 0 4px, currentColor 4px 5px);
}
</style>
