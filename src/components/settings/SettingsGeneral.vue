<script setup lang="ts">
import { computed, ref } from "vue";
import { toast } from "vue-sonner";

import SaveBar from "@/components/settings/SaveBar.vue";
import SettingsSection from "@/components/settings/SettingsSection.vue";
import { IconGlobe, IconImage, IconLink, IconLock, IconTrash, IconWarning } from "@/components/ui/icons";
import { useRoomLightArtwork } from "@/composables/useRoomLightArtwork";
import { AdminError, updateCollection } from "@/data/admin";
import { artworkPlaybackUrl, deleteArtworkFile, uploadArtworkFile } from "@/data/storage";
import type { CollectionVisibility, CollectionWithRole } from "@/data/types";
import { changedFields, changesLabel } from "@/utils/collectionSettings";
import { generateSlugFromTitle } from "@/utils/songUtils";

const props = defineProps<{ collection: CollectionWithRole }>();
const emit = defineEmits<{ updated: [collection: CollectionWithRole] }>();

type Draft = { title: string; slug: string; visibility: CollectionVisibility };
const fromCollection = (c: CollectionWithRole): Draft => ({
  title: c.title,
  slug: c.slug,
  visibility: c.visibility
});

const saved = ref<Draft>(fromCollection(props.collection));
const draft = ref<Draft>(fromCollection(props.collection));
const changes = computed(() => changedFields(saved.value, draft.value));
const saving = ref(false);
const error = ref("");

const slugError = computed(() => {
  if (!draft.value.slug) return "La dirección no puede quedar vacía.";
  if (!/^[a-z0-9-]+$/.test(draft.value.slug)) {
    return "Solo letras minúsculas, números y guiones.";
  }
  return "";
});
const titleError = computed(() => (draft.value.title.trim() ? "" : "El nombre es obligatorio."));

const VISIBILITY: {
  value: CollectionVisibility;
  label: string;
  description: string;
  icon: typeof IconLock;
}[] = [
  {
    value: "private",
    label: "Privada",
    description:
      "Solo la ven los miembros. Para entrar hay que tener cuenta y estar en la lista.",
    icon: IconLock
  },
  {
    value: "unlisted",
    label: "No listada",
    description:
      "La ve cualquiera que tenga el enlace, sin cuenta. No aparece en la biblioteca de otras personas.",
    icon: IconLink
  },
  {
    value: "public",
    label: "Pública",
    description: "La ve cualquiera y aparece en la biblioteca de todas las personas.",
    icon: IconGlobe
  }
];

async function save() {
  if (slugError.value || titleError.value) return;
  saving.value = true;
  error.value = "";
  try {
    const updated = await updateCollection(props.collection.id, {
      title: draft.value.title.trim(),
      slug: draft.value.slug,
      visibility: draft.value.visibility
    });
    saved.value = fromCollection({ ...props.collection, ...updated });
    draft.value = { ...saved.value };
    emit("updated", { ...props.collection, ...updated });
    toast.success("Guardado");
  } catch (e) {
    error.value = e instanceof AdminError ? e.message : "No se pudo guardar. Probá de nuevo.";
  } finally {
    saving.value = false;
  }
}

function discard() {
  draft.value = { ...saved.value };
  error.value = "";
}

// ---------- portada ----------

const artworkUrl = computed(() => artworkPlaybackUrl(props.collection));
const uploading = ref(false);
const dragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const { useArtwork } = useRoomLightArtwork(computed(() => props.collection.id));

async function uploadArtwork(file: File | undefined) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    toast.error("Elegí una imagen JPG, PNG o WebP.");
    return;
  }
  uploading.value = true;
  const previousKey = props.collection.artwork_file_key;
  try {
    const uploaded = await uploadArtworkFile(file, props.collection.id);
    const updated = await updateCollection(props.collection.id, {
      artwork_file_key: uploaded.key,
      artwork_file_url: null
    });
    emit("updated", { ...props.collection, ...updated, artwork_playback_url: uploaded.url });
    if (previousKey) await deleteArtworkFile(previousKey).catch(() => undefined);
    toast.success("Portada actualizada");
  } catch (e) {
    toast.error(`No se pudo subir la portada. ${(e as Error).message}`);
  } finally {
    uploading.value = false;
  }
}

async function removeArtwork() {
  const key = props.collection.artwork_file_key;
  try {
    const updated = await updateCollection(props.collection.id, {
      artwork_file_key: null,
      artwork_file_url: null
    });
    emit("updated", { ...props.collection, ...updated, artwork_playback_url: undefined });
    if (key) await deleteArtworkFile(key).catch(() => undefined);
    toast.success("Portada quitada");
  } catch (e) {
    toast.error(e instanceof AdminError ? e.message : "No se pudo quitar la portada.");
  }
}

function onDrop(event: DragEvent) {
  dragging.value = false;
  void uploadArtwork(event.dataTransfer?.files?.[0]);
}

const host = typeof window !== "undefined" ? window.location.host : "ensayando.com.ar";
</script>

<template>
  <SettingsSection
    title="General"
    description="Cómo se llama la colección, dónde vive y quién la puede ver."
  >
    <div class="bg-base-100 rounded-box border-base-content/10 grid gap-4 border p-5 md:grid-cols-2">
      <label class="flex flex-col gap-1.5">
        <span class="text-base-content/70 text-sm font-semibold">Nombre</span>
        <input
          v-model="draft.title"
          class="input w-full"
          :class="{ 'input-error': titleError }"
          data-testid="collection-title"
        />
        <span v-if="titleError" class="text-error text-xs">{{ titleError }}</span>
      </label>
      <label class="flex flex-col gap-1.5">
        <span class="text-base-content/70 flex items-center justify-between text-sm font-semibold">
          Dirección
          <button
            type="button"
            class="link link-hover text-xs font-medium"
            @click="draft.slug = generateSlugFromTitle(draft.title)"
          >
            Generar desde el nombre
          </button>
        </span>
        <span class="input w-full font-mono" :class="{ 'input-error': slugError }">
          <span class="text-base-content/40 text-sm">{{ host }}/</span>
          <input v-model="draft.slug" class="grow" autocapitalize="none" spellcheck="false" />
        </span>
        <span v-if="slugError" class="text-error text-xs">{{ slugError }}</span>
      </label>
      <div
        v-if="draft.slug !== saved.slug && !slugError"
        class="alert alert-warning alert-soft md:col-span-2"
      >
        <IconWarning class="size-4" />
        <span class="text-sm">
          Cambiaste la dirección. Los enlaces a
          <span class="font-mono">/{{ saved.slug }}</span> que ya compartiste van a dejar de
          funcionar.
        </span>
      </div>
    </div>

    <div class="bg-base-100 rounded-box border-base-content/10 flex flex-col gap-3 border p-5">
      <h2 class="font-semibold">Visibilidad</h2>
      <div class="grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="Visibilidad">
        <label
          v-for="option in VISIBILITY"
          :key="option.value"
          class="rounded-box flex cursor-pointer flex-col gap-1.5 border p-3.5 transition-colors"
          :class="
            draft.visibility === option.value
              ? 'border-primary bg-primary/10'
              : 'border-base-content/10 hover:border-base-content/25'
          "
        >
          <span class="flex items-center gap-2 font-semibold">
            <component :is="option.icon" class="size-4" />
            <span class="flex-1">{{ option.label }}</span>
            <input
              v-model="draft.visibility"
              type="radio"
              name="visibility"
              class="radio radio-primary radio-sm"
              :value="option.value"
            />
          </span>
          <span class="text-base-content/60 text-xs leading-relaxed">{{ option.description }}</span>
        </label>
      </div>
    </div>

    <div class="bg-base-100 rounded-box border-base-content/10 flex flex-col gap-3 border p-5">
      <h2 class="font-semibold">Portada</h2>
      <p class="text-base-content/60 max-w-2xl text-sm">
        Opcional. Cuadrada, al menos 1000 × 1000 px. Si la cargás, se ve en el banner de inicio, en la
        pantalla de bloqueo del teléfono y, desenfocada, como luz de fondo del reproductor. Sin portada
        no hay reemplazo ni espacio reservado.
      </p>
      <div class="flex flex-wrap items-center gap-4">
        <img
          v-if="artworkUrl"
          :src="artworkUrl"
          alt="Portada de la colección"
          class="rounded-box size-28 object-cover"
        />
        <div
          class="rounded-box flex min-h-20 flex-1 items-center gap-3 border border-dashed p-4 text-sm"
          :class="dragging ? 'border-primary bg-primary/10' : 'border-base-content/20'"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
        >
          <span v-if="uploading" class="loading loading-spinner loading-sm" />
          <IconImage v-else class="size-5 opacity-60" />
          <span class="text-base-content/70">
            <template v-if="uploading">Subiendo…</template>
            <template v-else>
              {{ artworkUrl ? "Arrastrá otra imagen o" : "Esta colección no tiene portada. Arrastrá una imagen o" }}
              <button type="button" class="link link-primary font-semibold" @click="fileInput?.click()">
                elegí un archivo</button
              >. JPG, PNG o WebP.
            </template>
          </span>
          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="hidden"
            @change="uploadArtwork(($event.target as HTMLInputElement).files?.[0])"
          />
        </div>
        <button v-if="artworkUrl" class="btn btn-ghost btn-sm text-error" @click="removeArtwork">
          <IconTrash class="size-4" /> Quitar
        </button>
      </div>
      <label class="flex items-center justify-between gap-3 text-sm">
        <span>
          Usar la portada como luz de sala
          <span class="text-base-content/50 block text-xs">Se guarda en este dispositivo.</span>
        </span>
        <input
          v-model="useArtwork"
          type="checkbox"
          class="toggle toggle-primary"
          :disabled="!artworkUrl"
        />
      </label>
    </div>

    <p v-if="error" class="text-error px-1 text-sm">{{ error }}</p>

    <SaveBar
      v-if="changes.length"
      :label="changesLabel(changes.length)"
      :saving="saving"
      :disabled="!!slugError || !!titleError"
      @save="save"
      @discard="discard"
    />
  </SettingsSection>
</template>
