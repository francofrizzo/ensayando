<script setup lang="ts">
type Props = {
  keyParts: string[];
  kbdClass?: string;
};

const props = withDefaults(defineProps<Props>(), {
  kbdClass: undefined
});
</script>

<template>
  <div class="flex gap-1 items-center">
    <template v-for="(keyPart, index) in keyParts" :key="keyPart">
      <kbd class="kbd text-base-content" :class="props.kbdClass">{{ keyPart }}</kbd>
      <span v-if="index !== keyParts.length - 1">+</span>
    </template>
  </div>
</template>
