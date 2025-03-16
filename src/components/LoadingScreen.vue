<script setup lang="ts">
import ProgressSpinner from 'primevue/progressspinner'
</script>

<template>
  <div class="w-full h-dvh flex flex-col gap-6 text-lg text-400 items-center justify-center p-2">
    <ProgressSpinner />
    <span class="text-muted uppercase text-muted-color tracking-wide">Cargando...</span>
  </div>
</template>
