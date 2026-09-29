<script setup lang="ts">
// The sounding verse's glow: a blurred copy of its text behind it, faded in and out
// with opacity. (A drop-shadow transitioned from `none` interpolates its color through
// black in Chrome, so on a jump the colored glow popped in at the end.) The copy is a
// pseudo-element so it doesn't show up as text. The parent must be `relative`, and
// the verse text after it `relative` too so it paints on top.
defineProps<{
  show: boolean;
  text: string;
  /** The verse's ink; the glow uses it at 55 %. */
  color: string | undefined;
}>();
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
    leave-active-class="transition-opacity duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <span
      v-if="show"
      aria-hidden="true"
      :data-text="text"
      class="pointer-events-none absolute inset-0 text-center leading-tight font-bold text-balance uppercase blur-[8px] select-none before:content-[attr(data-text)]"
      :style="{ color: `color-mix(in oklch, ${color ?? 'currentColor'} 55%, transparent)` }"
    />
  </Transition>
</template>
