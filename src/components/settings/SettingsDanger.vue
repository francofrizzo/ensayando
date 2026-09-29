<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";

import ConfirmTypedDialog from "@/components/settings/ConfirmTypedDialog.vue";
import SettingsSection from "@/components/settings/SettingsSection.vue";
import { IconTrash } from "@/components/ui/icons";
import { AdminError, deleteCollection } from "@/data/admin";
import type { CollectionWithRole } from "@/data/types";
import { useCollectionsStore } from "@/stores/collections";

const props = defineProps<{
  collection: CollectionWithRole;
  songCount: number;
  memberCount: number;
}>();

const router = useRouter();
const collectionsStore = useCollectionsStore();
const open = ref(false);
const busy = ref(false);
const error = ref("");

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);
const description = computed(
  () =>
    `Se eliminan ${plural(props.songCount, "canción", "canciones")} con sus pistas, letras y audios, y el acceso de ${plural(props.memberCount, "persona", "personas")}. Las cuentas de esas personas no se borran.`
);

async function confirm() {
  busy.value = true;
  error.value = "";
  try {
    const result = await deleteCollection(props.collection.id);
    open.value = false;
    const title = props.collection.title;
    collectionsStore.collections = collectionsStore.collections.filter(
      (c) => c.id !== props.collection.id
    );
    await router.replace({ name: "home" });
    if (result.orphanedKeys.length) {
      toast.warning(
        `Eliminaste "${title}", pero ${result.orphanedKeys.length} archivos no se pudieron borrar del almacenamiento.`
      );
    } else {
      toast.success(`Eliminaste "${title}"`);
    }
  } catch (e) {
    error.value = e instanceof AdminError ? e.message : "No se pudo eliminar la colección.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <SettingsSection title="Zona de peligro" description="No se puede deshacer.">
    <div
      class="bg-base-100 rounded-box border-error/40 flex flex-wrap items-center gap-4 border p-5"
    >
      <div class="flex min-w-60 flex-1 flex-col gap-1">
        <span class="font-semibold">Eliminar la colección</span>
        <span class="text-base-content/60 text-sm">{{ description }}</span>
      </div>
      <button class="btn btn-error btn-soft" data-testid="delete-collection" @click="open = true">
        <IconTrash class="size-4" /> Eliminar colección…
      </button>
    </div>

    <ConfirmTypedDialog
      :open="open"
      :title="`Eliminar ${props.collection.title}`"
      :description="description"
      :expected="props.collection.slug"
      confirm-label="Eliminar colección"
      :busy="busy"
      :error="error"
      @confirm="confirm"
      @cancel="
        open = false;
        error = '';
      "
    />
  </SettingsSection>
</template>
