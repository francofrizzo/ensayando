<script setup lang="ts">
defineProps<{ title: string; description?: string }>();
</script>

<template>
  <section class="flex flex-col gap-4 pb-4">
    <header class="flex flex-wrap items-end justify-between gap-3 px-1 pt-1">
      <div class="flex min-w-0 flex-col gap-1">
        <h1 class="font-display text-3xl font-bold">{{ title }}</h1>
        <p v-if="description" class="text-base-content/60 max-w-2xl text-sm">{{ description }}</p>
      </div>
      <slot name="actions" />
    </header>
    <slot />
  </section>
</template>
