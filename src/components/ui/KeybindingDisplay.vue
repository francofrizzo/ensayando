<script setup lang="ts">
type Props = {
  keyParts: string[];
  size?: "xs" | "sm" | "md" | "lg";
}

const props = withDefaults(defineProps<Props>(), {
  size: "sm"
});
</script>

<template>
  <div class="flex gap-1 items-center">
    <template v-for="(keyPart, index) in keyParts" :key="keyPart">
      <kbd class="kbd" :class="`kbd-${props.size}`">{{ keyPart }}</kbd>
      <span v-if="index !== keyParts.length - 1">+</span>
    </template>
  </div>
</template>
