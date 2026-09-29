<script setup lang="ts">
import { RouterView } from "vue-router";
import { Toaster } from "vue-sonner";
import "vue-sonner/style.css";

import { useTheme } from "@/composables/useTheme";

const { resolvedTheme } = useTheme();
</script>

<template>
  <RouterView v-slot="{ Component }">
    <Toaster :theme="resolvedTheme" rich-colors position="bottom-left" />
    <component :is="Component" />
  </RouterView>
</template>
