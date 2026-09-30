<script setup lang="ts">
import { IconHome, IconMoreVertical, IconShare } from "@/components/ui/icons";
import { usePwaInstall } from "@/composables/usePwaInstall";

const { guideOpen, isIOS, closeGuide } = usePwaInstall();
</script>

<template>
  <Teleport to="body">
    <dialog
      class="modal modal-bottom sm:modal-middle"
      :class="{ 'modal-open': guideOpen }"
      aria-labelledby="install-app-title"
      @cancel.prevent="closeGuide"
    >
      <div
        v-if="guideOpen"
        class="modal-box glass-3 flex max-w-md flex-col gap-5 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6"
        data-testid="install-app-dialog"
      >
        <div>
          <h2 id="install-app-title" class="font-display text-xl leading-tight font-bold">
            {{ isIOS ? "Cómo instalar en iPhone" : "Cómo instalar Ensayando" }}
          </h2>
          <p class="text-base-content/60 mt-1 text-sm">
            Se abre como una app, directamente desde tu pantalla de inicio.
          </p>
        </div>

        <ol class="flex flex-col gap-4">
          <li v-if="isIOS" class="flex items-start gap-3">
            <span class="bg-primary/12 text-primary grid size-10 shrink-0 place-items-center rounded-full">
              <IconShare class="size-5" />
            </span>
            <div>
              <h3 class="font-semibold">Tocá Compartir</h3>
              <p class="text-base-content/60 text-sm">Está en la barra del navegador.</p>
            </div>
          </li>
          <li v-else class="flex items-start gap-3">
            <span class="bg-primary/12 text-primary grid size-10 shrink-0 place-items-center rounded-full">
              <IconMoreVertical class="size-5" />
            </span>
            <div>
              <h3 class="font-semibold">Abrí el menú del navegador</h3>
              <p class="text-base-content/60 text-sm">Tocá los tres puntos de la barra.</p>
            </div>
          </li>
          <li class="flex items-start gap-3">
            <span class="bg-primary/12 text-primary grid size-10 shrink-0 place-items-center rounded-full">
              <IconHome class="size-5" />
            </span>
            <div>
              <h3 class="font-semibold">
                {{ isIOS ? "Elegí Agregar a inicio" : "Elegí Instalar app" }}
              </h3>
              <p class="text-base-content/60 text-sm">
                {{ isIOS ? "Después confirmá tocando Agregar." : "Después confirmá la instalación." }}
              </p>
            </div>
          </li>
        </ol>

        <button class="btn btn-primary w-full rounded-full" autofocus @click="closeGuide">
          Entendido
        </button>
      </div>
      <div v-if="guideOpen" class="modal-backdrop" @click="closeGuide" />
    </dialog>
  </Teleport>
</template>
