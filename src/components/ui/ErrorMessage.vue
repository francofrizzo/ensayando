<script setup lang="ts">
import { Rabbit, Search } from "lucide-vue-next";
import { computed } from "vue";
import type { RouteLocationRaw } from "vue-router";

type Props = {
  type: "not-found" | "collection-not-found" | "song-not-found" | "no-collections" | "no-songs";
  backLink?: {
    to: RouteLocationRaw;
    text: string;
  };
};

const props = defineProps<Props>();

const config = {
  "not-found": {
    icon: Search,
    title: "Página no encontrada",
    message: "La página que buscás no existe o fue movida."
  },
  "collection-not-found": {
    icon: Search,
    title: "Colección no encontrada",
    message: "La colección que buscás no existe o no está disponible."
  },
  "song-not-found": {
    icon: Search,
    title: "Canción no encontrada",
    message: "La canción que buscás no existe o no está disponible."
  },
  "no-collections": {
    icon: Rabbit,
    title: "No hay nada por acá",
    message: "No hay colecciones disponibles."
  },
  "no-songs": {
    icon: Rabbit,
    title: "No hay canciones",
    message:
      "Esta colección no tiene canciones. Las canciones aparecerán acá una vez que se agreguen a la colección."
  }
};

const icon = computed(() => config[props.type].icon);
const title = computed(() => config[props.type].title);
const message = computed(() => config[props.type].message);
</script>

<template>
  <div
    class="mx-auto flex min-h-dvh max-w-md flex-grow-1 flex-col items-center justify-center gap-4 text-center"
  >
    <component :is="icon" class="mb-4 size-22 opacity-50" />
    <h2 class="text-base-content/80 text-2xl font-semibold">{{ title }}</h2>
    <p class="text-base-content/40">{{ message }}</p>
    <router-link v-if="backLink" :to="backLink.to" class="btn btn-primary">
      {{ backLink.text }}
    </router-link>
  </div>
</template>
