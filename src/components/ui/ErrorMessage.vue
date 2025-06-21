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
}

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
    class="flex flex-col gap-4 flex-grow-1 min-h-dvh items-center justify-center max-w-md mx-auto text-center"
  >
    <component :is="icon" class="size-22 opacity-50 mb-4" />
    <h2 class="text-2xl font-semibold text-base-content/80">{{ title }}</h2>
    <p class="text-base-content/40">{{ message }}</p>
    <router-link v-if="backLink" :to="backLink.to" class="btn btn-primary">
      {{ backLink.text }}
    </router-link>
  </div>
</template>
