<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    barCount?: number;
    size?: "sm" | "md" | "lg";
  }>(),
  {
    barCount: 16,
    size: "md"
  }
);

const sizeConfig = {
  sm: { barWidth: 3, gap: 2, maxHeight: 20 },
  md: { barWidth: 3, gap: 3, maxHeight: 34 },
  lg: { barWidth: 4, gap: 4, maxHeight: 50 }
};

const config = sizeConfig[props.size];

// Seeded pseudo-random using mulberry32
const seed = 42;
const randoms: number[] = [];
let s = seed;
for (let i = 0; i < 32; i++) {
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  randoms.push(((t ^ (t >>> 14)) >>> 0) / 4294967296);
}
const CYCLE_DURATION = 1.6;
const barOffset = (i: number) => -(randoms[i % randoms.length]! * CYCLE_DURATION).toFixed(2);

// 0 at edges, 1 at center
const centerWeight = (i: number) => {
  const t = (i - 1) / (props.barCount - 1); // 0..1
  return Math.sin(t * Math.PI);
};

const barMin = (i: number) =>
  Math.round(5 + centerWeight(i) * 10 + randoms[(i + 5) % randoms.length]! * 15);
const barMax = (i: number) =>
  Math.round(35 + centerWeight(i) * 45 + randoms[(i + 17) % randoms.length]! * 20);
</script>

<template>
  <div
    class="flex items-center"
    :style="{ gap: `${config.gap}px`, height: `${config.maxHeight}px` }"
  >
    <div
      v-for="i in barCount"
      :key="i"
      class="loading-bar rounded-full bg-current"
      :style="{
        width: `${config.barWidth}px`,
        animationDelay: `${barOffset(i)}s`,
        '--bar-min': `${barMin(i)}%`,
        '--bar-max': `${barMax(i)}%`
      }"
    />
  </div>
</template>

<style scoped>
.loading-bar {
  height: var(--bar-min);
  animation: waveform 1.6s ease-in-out infinite;
}

@keyframes waveform {
  0%,
  15%,
  100% {
    height: var(--bar-min);
  }
  45%,
  65% {
    height: var(--bar-max);
  }
}
</style>
