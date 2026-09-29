<script setup lang="ts">
defineProps<{ title: string; description?: string }>();
</script>

<template>
  <section class="mx-auto flex w-full max-w-5xl flex-col gap-4 pb-4 md:gap-5 md:px-3 md:pt-2 lg:gap-6 lg:px-8 lg:pt-6 xl:px-12 xl:pt-8">
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
