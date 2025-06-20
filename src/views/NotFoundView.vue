<script setup lang="ts">
import ErrorMessage from "@/components/ui/ErrorMessage.vue";
</script>

<template>
  <ErrorMessage
    type="not-found"
    :back-link="{
      to: { name: 'home' },
      text: 'Volver al inicio'
    }"
  />
</template>
