<script setup lang="ts">
import { computed } from "vue";

import { useTheme } from "@/composables/useTheme";
import { deriveColor, type Intensity } from "@/utils/palette";

// Hue picker: a range over the color circle painted with the real fill colors, with
// marks for the other tracks so collisions are visible before they happen.
const props = defineProps<{
  modelValue: number;
  intensity: Intensity;
  marks?: { hue: number; label: string; warn?: boolean }[];
  disabled?: boolean;
  label?: string;
}>();

const emit = defineEmits<{ "update:modelValue": [value: number] }>();

const { resolvedTheme } = useTheme();

const track = computed(() => {
  const stops = Array.from({ length: 13 }, (_, i) => {
    const hue = i * 30;
    const color = deriveColor({ hue, intensity: props.intensity }, "fill", resolvedTheme.value);
    return `${color} ${((hue / 360) * 100).toFixed(1)}%`;
  });
  return `linear-gradient(to right, ${stops.join(", ")})`;
});

const thumbColor = computed(() =>
  deriveColor({ hue: props.modelValue, intensity: props.intensity }, "fill", resolvedTheme.value)
);

const percent = (hue: number) => `${(hue / 359) * 100}%`;
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="relative h-6">
      <div
        class="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full"
        :class="{ 'opacity-30 saturate-0': props.disabled }"
        :style="{ backgroundImage: track }"
      />
      <span
        v-for="mark in props.marks ?? []"
        :key="mark.label"
        class="absolute top-0 h-6 w-0.5 -translate-x-1/2 rounded-full"
        :class="mark.warn ? 'bg-warning' : 'bg-base-content/40'"
        :style="{ left: percent(mark.hue) }"
      />
      <input
        type="range"
        min="0"
        max="359"
        step="1"
        class="hue-range absolute inset-0 w-full cursor-pointer appearance-none bg-transparent"
        :aria-label="props.label ?? 'Tono'"
        :value="props.modelValue"
        :disabled="props.disabled"
        :style="{ '--thumb': thumbColor }"
        @input="emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
      />
    </div>
    <div v-if="props.marks?.length" class="relative h-4 text-[11px]">
      <span
        v-for="mark in props.marks"
        :key="mark.label"
        class="absolute -translate-x-1/2 whitespace-nowrap"
        :class="mark.warn ? 'text-warning font-semibold' : 'text-base-content/50'"
        :style="{ left: percent(mark.hue) }"
        >{{ mark.label }}</span
      >
    </div>
  </div>
</template>

<style scoped>
/* Native range thumbs need pseudo-elements; the track is the div behind. */
.hue-range::-webkit-slider-thumb {
  appearance: none;
  width: 22px;
  height: 22px;
  border-radius: 9999px;
  background: var(--thumb);
  border: 3px solid white;
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.35);
}
.hue-range::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 9999px;
  background: var(--thumb);
  border: 3px solid white;
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.35);
}
.hue-range:disabled::-webkit-slider-thumb {
  display: none;
}
</style>
