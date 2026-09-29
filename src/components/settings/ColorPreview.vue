<script setup lang="ts">
import { computed } from "vue";

import { type ColorSpec, deriveColor, canvasColor, type Theme } from "@/utils/palette";

// Live preview of a track color in both themes: lyrics (with the active verse) and a
// waveform, painted with the same derivation the player uses.
const props = defineProps<{ spec: ColorSpec; collectionHue: number }>();

const LINES = [
  "Alexander Hamilton",
  "Te estamos esperando a vos",
  "Ya no hay vuelta atrás",
  "Ya la historia te da tu lugar"
];

// Deterministic bar heights, so the preview doesn't jump between renders.
const BARS = Array.from({ length: 48 }, (_, i) => {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  const noise = x - Math.floor(x);
  return Math.round(20 + 80 * Math.abs(Math.sin(i / 5)) * (0.5 + 0.5 * noise));
});

const themes = computed(() =>
  (["light", "dark"] as Theme[]).map((theme) => ({
    theme,
    label: theme === "light" ? "Claro" : "Oscuro",
    background: canvasColor(theme, props.collectionHue),
    muted: theme === "light" ? "oklch(0.47 0.02 0)" : "oklch(0.73 0.02 0)",
    lyric: deriveColor(props.spec, "lyric", theme),
    wave: deriveColor(props.spec, "wave", theme),
    waveDim: deriveColor(props.spec, "wave", theme, 0.3)
  }))
);
</script>

<template>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <div
      v-for="t in themes"
      :key="t.theme"
      class="rounded-box border-base-content/10 flex min-w-0 flex-col gap-3 overflow-hidden border p-4"
      :style="{ background: t.background }"
      :data-theme="t.theme"
    >
      <span class="text-[11px] font-semibold tracking-widest uppercase" :style="{ color: t.muted }">
        {{ t.label }}
      </span>
      <div class="font-lyrics flex flex-col items-center gap-1 text-center uppercase">
        <span
          v-for="(line, i) in LINES"
          :key="line"
          :class="i === 1 ? 'text-lg font-bold' : 'text-sm'"
          :style="{ color: t.lyric }"
          >{{ line }}</span
        >
      </div>
      <!-- Scales to the card width: bars are drawn in a fixed viewBox -->
      <svg
        class="block h-8 w-full"
        :viewBox="`0 0 ${BARS.length * 5} 100`"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <rect
          v-for="(height, i) in BARS"
          :key="i"
          :x="i * 5"
          :y="(100 - height) / 2"
          width="3"
          :height="height"
          rx="1.5"
          :fill="i < 18 ? t.wave : t.waveDim"
        />
      </svg>
    </div>
  </div>
</template>
