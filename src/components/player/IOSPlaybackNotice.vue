<script setup lang="ts">
import { IconLock, IconVolumeOff } from "@/components/ui/icons";

const props = defineProps<{ show: boolean }>();
const emit = defineEmits<{ dismiss: [] }>();
</script>

<template>
  <Teleport to="body">
    <dialog
      class="modal modal-bottom sm:modal-middle"
      :class="{ 'modal-open': props.show }"
      aria-labelledby="ios-playback-notice-title"
    >
      <div
        v-if="props.show"
        class="modal-box glass-3 flex max-w-md flex-col gap-5 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6"
        data-testid="ios-playback-notice"
      >
        <h2 id="ios-playback-notice-title" class="font-display text-xl leading-tight font-bold">
          Recomendaciones para que Ensayando funcione correctamente en tu iPhone
        </h2>

        <div class="flex flex-col gap-4">
          <div class="flex items-start gap-3">
            <span
              class="bg-warning/15 text-warning flex size-10 shrink-0 items-center justify-center rounded-full"
              aria-hidden="true"
            >
              <IconVolumeOff class="size-5" />
            </span>
            <div class="flex min-w-0 flex-col gap-1">
              <h3 class="font-semibold">Desactivá el modo silencio</h3>
              <p class="text-base-content/65 text-sm leading-relaxed">
                Según tu iPhone, podés hacerlo desde el interruptor lateral, el botón Acción o el
                Centro de control.
              </p>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <span
              class="bg-info/15 text-info flex size-10 shrink-0 items-center justify-center rounded-full"
              aria-hidden="true"
            >
              <IconLock class="size-5" />
            </span>
            <div class="flex min-w-0 flex-col gap-1">
              <h3 class="font-semibold">Mantené la pantalla encendida</h3>
              <p class="text-base-content/65 text-sm leading-relaxed">
                Si se bloquea, la reproducción puede detenerse.
              </p>
            </div>
          </div>
        </div>

        <button class="btn btn-primary w-full rounded-full" autofocus @click="emit('dismiss')">
          Entendido
        </button>
      </div>
    </dialog>
  </Teleport>
</template>
