<script setup lang="ts">
// The frame of the sign-in screens (design/pantallas/ingreso-estados.html): the
// brand room light, the logo with a title, and the form on a glass panel.
import RoomLight from "@/components/ui/RoomLight.vue";

defineProps<{ title: string }>();
</script>

<template>
  <div class="bg-base-200 relative isolate flex min-h-dvh items-center justify-center p-3 sm:p-6">
    <RoomLight />
    <div class="w-full max-w-md">
      <div
        class="mb-8 text-center"
        style="animation: empty-stagger 400ms ease-out both; animation-delay: 0ms"
      >
        <div class="mb-3 flex justify-center">
          <img src="/pwa-512x512.png" alt="Ensayando" class="h-16 w-16" />
        </div>
        <h1 class="font-display text-3xl font-bold">{{ title }}</h1>
      </div>

      <div
        class="glass-2 rounded-box p-4 sm:p-8"
        style="animation: empty-stagger 400ms ease-out both; animation-delay: 100ms"
      >
        <slot />
      </div>
    </div>
  </div>
</template>
