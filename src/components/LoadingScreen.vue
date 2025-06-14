<script setup lang="ts">
import { Loader2 } from "lucide-vue-next";
</script>

<template>
  <div
    class="w-full h-dvh flex flex-col gap-6 text-lg text-base-content/50 items-center justify-center p-2"
  >
    <Loader2 class="w-16 h-16 animate-spin" />
    <span class="uppercase tracking-wide">Cargando...</span>
  </div>
</template>
