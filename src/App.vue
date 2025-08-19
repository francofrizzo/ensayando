<script setup lang="ts">
import { RouterView } from "vue-router";
import { Toaster } from "vue-sonner";
import "vue-sonner/style.css";

const isDarkTheme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
</script>

<template>
  <RouterView v-slot="{ Component }">
    <Toaster :theme="isDarkTheme ? 'dark' : 'light'" rich-colors position="bottom-left" />
    <component :is="Component" />
  </RouterView>
</template>
