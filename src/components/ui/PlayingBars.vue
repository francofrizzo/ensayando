<script setup lang="ts">
// Three small bars marking the song that is loaded; they move while it plays.
defineProps<{ playing?: boolean }>();
</script>

<template>
  <span class="inline-flex h-3 items-end gap-[2px]" aria-hidden="true">
    <i
      v-for="n in 3"
      :key="n"
      class="w-[2.5px] rounded-[1px] bg-current"
      :class="playing ? 'playing-bar' : ''"
      :style="{ height: ['60%', '100%', '40%'][n - 1], animationDelay: `${-(n - 1) * 300}ms` }"
    />
  </span>
</template>

<style scoped>
.playing-bar {
  animation: playing-bar 900ms cubic-bezier(0.22, 1, 0.36, 1) infinite alternate;
}
@keyframes playing-bar {
  to {
    height: 25%;
  }
}
@media (prefers-reduced-motion: reduce) {
  .playing-bar {
    animation: none;
  }
}
</style>
