<script setup lang="ts">
import { RouterView } from "vue-router";
import { Toaster } from "vue-sonner";
import PWAInstallPrompt from "@/components/PWAInstallPrompt.vue";
import "vue-sonner/style.css";
</script>

<template>
  <RouterView v-slot="{ Component }">
    <Toaster rich-colors />
    <component :is="Component" />
    <PWAInstallPrompt />
  </RouterView>
</template>
