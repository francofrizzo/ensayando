<script setup lang="ts">
import { computed } from "vue";
import { toast } from "vue-sonner";

import { IconCopy } from "@/components/ui/icons";
import { shareMessage } from "@/utils/collectionSettings";

// A managed account's password, shown once: after closing, nobody can see it again.
const props = defineProps<{
  open: boolean;
  username: string;
  password: string;
  isNew?: boolean;
}>();
const emit = defineEmits<{ close: [] }>();

const message = computed(() =>
  shareMessage(typeof window !== "undefined" ? window.location.origin : "", props.username, props.password)
);

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error("No se pudo copiar. Seleccioná el texto y copialo a mano.");
  }
}
</script>

<template>
  <dialog class="modal" :class="{ 'modal-open': props.open }">
    <div v-if="props.open" class="modal-box glass-3 flex max-w-md flex-col gap-4" data-testid="password-dialog">
      <h3 class="font-display text-xl font-bold">
        {{ props.isNew ? `Cuenta creada: ${props.username}` : `Contraseña nueva para ${props.username}` }}
      </h3>
      <p class="text-base-content/70 text-sm">
        {{ props.isNew ? "" : "La anterior dejó de funcionar. " }}Copiala y pasásela: cuando cierres este
        cuadro no se vuelve a mostrar.
      </p>
      <div class="bg-base-300 rounded-box flex items-center gap-3 p-3">
        <span class="flex-1 font-mono text-xl font-semibold select-all" data-testid="one-time-password">{{
          props.password
        }}</span>
        <button class="btn btn-primary btn-sm" @click="copy(props.password, 'Contraseña copiada')">
          <IconCopy class="size-4" /> Copiar
        </button>
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="text-base-content/60 text-xs font-semibold">Mensaje listo para mandar</span>
        <p class="border-base-content/10 rounded-box border p-3 text-sm select-all">{{ message }}</p>
      </div>
      <div class="modal-action mt-0">
        <button class="btn btn-soft" @click="copy(message, 'Mensaje copiado')">
          <IconCopy class="size-4" /> Copiar mensaje
        </button>
        <button class="btn btn-primary" @click="emit('close')">Listo</button>
      </div>
    </div>
  </dialog>
</template>
