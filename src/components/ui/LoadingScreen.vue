<script setup lang="ts">
import { Loader2 } from "lucide-vue-next";
</script>

<template>
  <div
    class="text-base-content/50 flex h-dvh w-full flex-col items-center justify-center gap-6 p-2 text-lg select-none"
  >
    <Loader2 class="h-16 w-16 animate-spin" />
    <span class="tracking-wide uppercase">Cargando...</span>
  </div>
</template>
