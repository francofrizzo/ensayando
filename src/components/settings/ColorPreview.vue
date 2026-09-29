<script setup lang="ts">
import { computed } from "vue";

import { type ColorSpec, deriveColor, canvasColor, type Theme } from "@/utils/palette";

// Live preview of a track color in both themes: lyrics (with the active verse) and a
// waveform, painted with the same derivation the player uses.
const props = defineProps<{ spec: ColorSpec; collectionHue: number }>();

const LINES = ["Cada nota que se asoma", "Vuelve al mismo corazón", "Que el viento te va a llevar"];

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
      class="rounded-box border-base-content/10 flex flex-col gap-3 border p-4"
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
      <div class="flex h-8 items-center gap-[2px]" aria-hidden="true">
        <span
          v-for="(height, i) in BARS"
          :key="i"
          class="w-[3px] shrink-0 rounded-full"
          :style="{ height: `${height}%`, background: i < 18 ? t.wave : t.waveDim }"
        />
      </div>
    </div>
  </div>
</template>
