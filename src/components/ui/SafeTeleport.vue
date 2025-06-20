<script setup lang="ts">
import { useTeleportTarget } from "@/composables/useTeleportTarget";

interface Props {
  to: string;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false
});

const { isReady } = useTeleportTarget(props.to);
</script>

<template>
  <Teleport v-if="isReady && !props.disabled" :to="props.to">
    <slot />
  </Teleport>
</template>
