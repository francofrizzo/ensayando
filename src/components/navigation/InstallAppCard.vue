<script setup lang="ts">
import { IconClose, IconMobile } from "@/components/ui/icons";
import { usePwaInstall } from "@/composables/usePwaInstall";

const { showCard, hasNativePrompt, install, dismissCard } = usePwaInstall();
</script>

<template>
  <aside
    v-if="showCard"
    class="glass-2 col-span-full flex items-center gap-3 rounded-[18px] p-3 sm:hidden"
    data-testid="install-app-card"
  >
    <span
      class="bg-primary/12 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl"
      aria-hidden="true"
    >
      <IconMobile class="size-5" />
    </span>
    <div class="min-w-0 flex-1">
      <h2 class="font-display text-sm leading-tight font-bold">Instalá Ensayando como app</h2>
      <p class="text-base-content/60 mt-0.5 text-xs">Abrila desde tu pantalla de inicio.</p>
    </div>
    <button type="button" class="btn btn-primary btn-sm rounded-full" @click="install">
      {{ hasNativePrompt ? "Instalar" : "Ver cómo" }}
    </button>
    <button
      type="button"
      class="btn btn-circle btn-ghost btn-xs"
      aria-label="Ocultar sugerencia"
      @click="dismissCard"
    >
      <IconClose class="size-4" />
    </button>
  </aside>
</template>
