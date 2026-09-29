<script setup lang="ts">
import { IconCheck } from "@/components/ui/icons";

// Sticky bar at the bottom of a settings section while it has unsaved changes.
const props = defineProps<{
  label: string;
  saving?: boolean;
  saveLabel?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{ save: []; discard: [] }>();
</script>

<template>
  <div
    class="glass-2 rounded-box sticky bottom-3 z-20 flex items-center gap-3 px-4 py-3"
    data-testid="save-bar"
  >
    <span class="bg-primary size-2 shrink-0 rounded-full" />
    <span class="min-w-0 flex-1 truncate text-sm font-semibold">{{ props.label }}</span>
    <button class="btn btn-ghost btn-sm" :disabled="props.saving" @click="emit('discard')">
      Descartar
    </button>
    <button
      class="btn btn-primary btn-sm"
      :disabled="props.saving || props.disabled"
      @click="emit('save')"
    >
      <span v-if="props.saving" class="loading loading-spinner loading-xs" />
      <IconCheck v-else class="size-4" />
      {{ props.saveLabel ?? "Guardar" }}
    </button>
  </div>
</template>
