<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";

import HueSlider from "@/components/settings/HueSlider.vue";
import SegmentedControl from "@/components/settings/SegmentedControl.vue";
import { IconGlobe, IconLink, IconLock, IconPalette, IconPlus } from "@/components/ui/icons";
import LoadingScreen from "@/components/ui/LoadingScreen.vue";
import RoomLight from "@/components/ui/RoomLight.vue";
import { useTheme } from "@/composables/useTheme";
import { AdminError, createCollection, fetchIsAppAdmin } from "@/data/admin";
import type { Collection, CollectionVisibility } from "@/data/types";
import { useCollectionsStore } from "@/stores/collections";
import { collectionSlugError } from "@/utils/collectionSlug";
import { deriveColor, type Intensity } from "@/utils/palette";
import { generateSlugFromTitle } from "@/utils/songUtils";

// Nueva colección (/nueva-coleccion): only app admins. The creator becomes the
// collection's admin (database trigger) and lands on its settings.
const router = useRouter();
const collectionsStore = useCollectionsStore();
const { resolvedTheme } = useTheme();

const checking = ref(true);
const allowed = ref(false);
onMounted(async () => {
  allowed.value = await fetchIsAppAdmin();
  checking.value = false;
});

const title = ref("");
const slug = ref("");
const slugTouched = ref(false);
watch(title, (value) => {
  if (!slugTouched.value) slug.value = generateSlugFromTitle(value);
});

const PRESETS = [300, 45, 150, 250, 10, 95];
const hue = ref(300);
const intensity = ref<Intensity>("media");
const customHue = ref(false);
const INTENSITIES = [
  { value: "suave" as const, label: "Suave" },
  { value: "media" as const, label: "Media" },
  { value: "intensa" as const, label: "Intensa" }
];
const visibility = ref<CollectionVisibility>("private");
const busy = ref(false);
const error = ref("");

const swatch = (h: number) =>
  deriveColor({ hue: h, intensity: intensity.value }, "fill", resolvedTheme.value);
// RoomLight only reads the palette fields.
const previewCollection = computed(
  () => ({ hue: hue.value, intensity: intensity.value, track_colors: {} }) as unknown as Collection
);

const slugError = computed(() =>
  slug.value ? collectionSlugError(slug.value) : ""
);
const canCreate = computed(() => title.value.trim() && slug.value && !slugError.value && !busy.value);

async function create() {
  if (!canCreate.value) return;
  busy.value = true;
  error.value = "";
  try {
    const created = await createCollection({
      title: title.value.trim(),
      slug: slug.value,
      hue: hue.value,
      intensity: intensity.value,
      track_colors: {},
      visibility: visibility.value
    });
    await collectionsStore.fetchCollections();
    toast.success(`Creaste "${created.title}"`);
    await router.replace({
      name: "collection-settings",
      params: { collectionSlug: created.slug, section: "" }
    });
  } catch (e) {
    error.value = e instanceof AdminError ? e.message : "No se pudo crear la colección.";
  } finally {
    busy.value = false;
  }
}

const VISIBILITY = [
  { value: "private" as const, label: "Privada", icon: IconLock },
  { value: "unlisted" as const, label: "No listada", icon: IconLink },
  { value: "public" as const, label: "Pública", icon: IconGlobe }
];
const host = typeof window !== "undefined" ? window.location.host : "ensayando.com.ar";
</script>

<template>
  <div class="relative isolate flex min-h-dvh items-center justify-center p-3 sm:p-6">
    <RoomLight :collection="previewCollection" />
    <LoadingScreen v-if="checking" />

    <div v-else-if="!allowed" class="flex flex-col items-center gap-4 text-center">
      <IconLock class="size-16 opacity-40" />
      <h1 class="font-display text-2xl font-bold">No podés crear colecciones</h1>
      <p class="text-base-content/60 max-w-sm">
        Solo quien administra la app puede crearlas.
      </p>
      <button class="btn btn-primary" @click="router.push({ name: 'home' })">Volver al inicio</button>
    </div>

    <form
      v-else
      class="glass-2 rounded-box flex w-full max-w-lg flex-col gap-4 p-5 sm:p-7"
      @submit.prevent="create"
    >
      <h1 class="font-display text-2xl font-bold">Nueva colección</h1>

      <label class="flex flex-col gap-1.5">
        <span class="text-base-content/70 text-sm font-semibold">Nombre</span>
        <input v-model="title" class="input w-full field-focus" placeholder="Taller de musicales 2027" data-testid="new-title" />
      </label>

      <label class="flex flex-col gap-1.5">
        <span class="text-base-content/70 text-sm font-semibold">Dirección</span>
        <span class="input w-full font-mono field-focus" :class="{ 'input-error': slugError }">
          <span class="text-base-content/40 text-sm">{{ host }}/</span>
          <input
            v-model="slug"
            class="grow"
            autocapitalize="none"
            spellcheck="false"
            @input="slugTouched = true"
          />
        </span>
        <span v-if="slugError" class="text-error text-xs">{{ slugError }}</span>
      </label>

      <div class="flex flex-col gap-2">
        <span class="text-base-content/70 text-sm font-semibold">Color principal</span>
        <div class="flex flex-wrap items-center gap-2">
          <button
            v-for="h in PRESETS"
            :key="h"
            type="button"
            class="size-9 rounded-full transition-transform"
            :class="{ 'ring-base-content ring-2 ring-offset-2 ring-offset-transparent': !customHue && hue === h }"
            :style="{ background: swatch(h) }"
            :aria-label="`Tono ${h}°`"
            @click="
              hue = h;
              customHue = false;
            "
          />
          <button
            type="button"
            class="btn btn-sm btn-soft rounded-full"
            :class="{ 'btn-active': customHue }"
            @click="customHue = !customHue"
          >
            <IconPalette class="size-4" /> Otro
          </button>
        </div>
        <HueSlider v-if="customHue" v-model="hue" :intensity="intensity" label="Tono del color principal" />
        <SegmentedControl
          v-model="intensity"
          :options="INTENSITIES"
          label="Intensidad"
          class="self-start"
          data-testid="new-intensity"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <span class="text-base-content/70 text-sm font-semibold">Visibilidad</span>
        <SegmentedControl v-model="visibility" :options="VISIBILITY" label="Visibilidad" stretch />
      </div>

      <p v-if="error" class="text-error text-sm">{{ error }}</p>

      <div class="flex justify-end gap-2">
        <button type="button" class="btn btn-ghost" @click="router.back()">Cancelar</button>
        <button type="submit" class="btn btn-primary" :disabled="!canCreate" data-testid="create-collection">
          <span v-if="busy" class="loading loading-spinner loading-xs" />
          <IconPlus v-else class="size-4" />
          Crear colección
        </button>
      </div>
    </form>
  </div>
</template>
