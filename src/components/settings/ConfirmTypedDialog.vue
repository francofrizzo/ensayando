<script setup lang="ts">
import { computed, ref, watch } from "vue";

import { IconTrash, IconWarning } from "@/components/ui/icons";
import { confirmationMatches } from "@/utils/collectionSettings";

// Irreversible actions: the person types the name (or address) to confirm.
const props = defineProps<{
  open: boolean;
  title: string;
  description: string;
  expected: string;
  confirmLabel: string;
  busy?: boolean;
  error?: string;
}>();

const emit = defineEmits<{ confirm: []; cancel: [] }>();

const typed = ref("");
watch(
  () => props.open,
  (open) => {
    if (open) typed.value = "";
  }
);

const matches = computed(() => confirmationMatches(typed.value, props.expected));
</script>

<template>
  <dialog class="modal" :class="{ 'modal-open': props.open }" @cancel.prevent="emit('cancel')">
    <div v-if="props.open" class="modal-box glass-3 flex max-w-md flex-col gap-4">
      <span class="badge badge-soft badge-error gap-1.5 self-start">
        <IconWarning class="size-3.5" /> No se puede deshacer
      </span>
      <h3 class="font-display text-xl font-bold">{{ props.title }}</h3>
      <p class="text-base-content/70 text-sm">{{ props.description }}</p>
      <label class="flex flex-col gap-1.5">
        <span class="text-base-content/70 text-xs font-semibold">
          Para confirmar, escribí <span class="font-mono">{{ props.expected }}</span>
        </span>
        <input
          v-model="typed"
          class="input w-full font-mono field-focus"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          data-testid="confirm-input"
          @keydown.enter="matches && !props.busy && emit('confirm')"
        />
      </label>
      <p v-if="props.error" class="text-error text-sm">{{ props.error }}</p>
      <div class="modal-action mt-0">
        <button class="btn btn-ghost" :disabled="props.busy" @click="emit('cancel')">
          Cancelar
        </button>
        <button
          class="btn btn-error"
          :disabled="!matches || props.busy"
          data-testid="confirm-delete"
          @click="emit('confirm')"
        >
          <span v-if="props.busy" class="loading loading-spinner loading-xs" />
          <IconTrash v-else class="size-4" />
          {{ props.confirmLabel }}
        </button>
      </div>
    </div>
    <div class="modal-backdrop" @click="!props.busy && emit('cancel')" />
  </dialog>
</template>
