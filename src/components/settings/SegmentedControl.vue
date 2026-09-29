<script setup lang="ts" generic="T extends string">
import type { Component } from "vue";

// Pill segmented control (design/shared/mock.css .seg): intensity, role, visibility.
const props = defineProps<{
  modelValue: T;
  options: { value: T; label: string; icon?: Component }[];
  disabled?: boolean;
  label: string;
  stretch?: boolean;
}>();

const emit = defineEmits<{ "update:modelValue": [value: T] }>();
</script>

<template>
  <div
    class="bg-base-content/7 inline-flex gap-0.5 rounded-full p-1"
    :class="{ 'flex w-full': props.stretch, 'opacity-50': props.disabled }"
    role="radiogroup"
    :aria-label="props.label"
  >
    <button
      v-for="option in props.options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="props.modelValue === option.value"
      :disabled="props.disabled"
      class="inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors"
      :class="[
        props.stretch ? 'flex-1' : '',
        props.modelValue === option.value
          ? 'bg-base-100 text-base-content shadow-sm'
          : 'text-base-content/60 hover:text-base-content'
      ]"
      @click="emit('update:modelValue', option.value)"
    >
      <component :is="option.icon" v-if="option.icon" class="size-4" />
      {{ option.label }}
    </button>
  </div>
</template>
