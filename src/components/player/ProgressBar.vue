<script setup lang="ts">
import { computed, ref } from "vue";

// Plain progress bar, only where the waveforms aren't visible (compact dock, phone).
const props = defineProps<{
  currentTime: number;
  totalDuration: number;
  disabled?: boolean;
}>();

const emit = defineEmits<{ seek: [time: number] }>();

const bar = ref<HTMLElement | null>(null);
const progress = computed(() =>
  props.totalDuration > 0 ? Math.min(1, Math.max(0, props.currentTime / props.totalDuration)) : 0
);

const seekFromPointer = (event: PointerEvent) => {
  if (props.disabled || !bar.value || props.totalDuration <= 0) return;
  const rect = bar.value.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  emit("seek", ratio * props.totalDuration);
};

const onPointerDown = (event: PointerEvent) => {
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  seekFromPointer(event);
};

const onPointerMove = (event: PointerEvent) => {
  if ((event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) {
    seekFromPointer(event);
  }
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  event.stopPropagation();
  const step = event.key === "ArrowLeft" ? -5 : 5;
  emit("seek", Math.min(props.totalDuration, Math.max(0, props.currentTime + step)));
};
</script>

<template>
  <div
    ref="bar"
    class="group relative flex h-5 cursor-pointer touch-none items-center"
    role="slider"
    tabindex="0"
    aria-label="Posición"
    :aria-valuemin="0"
    :aria-valuemax="Math.round(props.totalDuration)"
    :aria-valuenow="Math.round(props.currentTime)"
    :aria-disabled="props.disabled || undefined"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @keydown="onKeydown"
  >
    <div class="bg-base-content/12 absolute inset-x-0 h-[5px] rounded-full" />
    <div
      class="bg-primary absolute left-0 h-[5px] rounded-full"
      :style="{ width: `${progress * 100}%` }"
    />
    <div
      class="bg-base-100 absolute size-3.5 -translate-x-1/2 rounded-full shadow-[0_0_0_1px_var(--glass-edge),0_2px_6px_oklch(0%_0_0/0.25)] transition-transform group-active:scale-110"
      :style="{ left: `${progress * 100}%` }"
    />
  </div>
</template>
