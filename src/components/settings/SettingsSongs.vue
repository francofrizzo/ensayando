<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";

import ConfirmTypedDialog from "@/components/settings/ConfirmTypedDialog.vue";
import SettingsSection from "@/components/settings/SettingsSection.vue";
import {
  IconCopy,
  IconDragHandle,
  IconEdit,
  IconLock,
  IconLyrics,
  IconMore,
  IconMoveDown,
  IconMoveUp,
  IconPlus,
  IconTrash
} from "@/components/ui/icons";
import { AdminError, deleteSong, reorderSongs } from "@/data/admin";
import { updateSongBasicInfo } from "@/data/supabase";
import type { CollectionWithRole, Song } from "@/data/types";
import { useCollectionsStore } from "@/stores/collections";
import { formatTime } from "@/utils/datetime-utils";

const props = defineProps<{ collection: CollectionWithRole }>();

const collectionsStore = useCollectionsStore();
const list = ref<Song[]>([]);
watch(
  () => collectionsStore.songs,
  (songs) => (list.value = [...songs]),
  { immediate: true }
);

const refresh = () => collectionsStore.fetchSongsByCollectionId(props.collection.id);

// ---------- order ----------

const dragIndex = ref<number | null>(null);
const overIndex = ref<number | null>(null);

async function commitOrder(next: Song[]) {
  const previous = list.value;
  list.value = next;
  try {
    await reorderSongs(
      props.collection.id,
      next.map((s) => s.id)
    );
    await refresh();
  } catch (e) {
    list.value = previous;
    toast.error(e instanceof AdminError ? e.message : "No se pudo cambiar el orden.");
  }
}

function onDrop(target: number) {
  const from = dragIndex.value;
  dragIndex.value = null;
  overIndex.value = null;
  if (from === null || from === target) return;
  const next = [...list.value];
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved!);
  void commitOrder(next);
}

function move(index: number, delta: number) {
  const target = index + delta;
  if (target < 0 || target >= list.value.length) return;
  const next = [...list.value];
  [next[index], next[target]] = [next[target]!, next[index]!];
  void commitOrder(next);
}

// ---------- visibility ----------

async function toggleVisible(song: Song) {
  const visible = !song.visible;
  song.visible = visible;
  const { error } = await updateSongBasicInfo(song.id, {
    title: song.title,
    slug: song.slug,
    visible
  });
  if (error) {
    song.visible = !visible;
    toast.error("No se pudo cambiar la visibilidad.");
    return;
  }
  await refresh();
}

// ---------- menu actions ----------

async function copyLink(song: Song) {
  const url = `${window.location.origin}/${props.collection.slug}/${song.slug}`;
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Enlace copiado");
  } catch {
    toast.error(url);
  }
}

const toDelete = ref<Song | null>(null);
const deleting = ref(false);
const deleteError = ref("");

async function confirmDelete() {
  const song = toDelete.value;
  if (!song) return;
  deleting.value = true;
  deleteError.value = "";
  try {
    const result = await deleteSong(song.id);
    toDelete.value = null;
    await refresh();
    if (result.orphanedKeys.length) {
      toast.warning(
        `Eliminaste "${song.title}", pero ${result.orphanedKeys.length} archivos de audio no se pudieron borrar del almacenamiento.`
      );
    } else {
      toast.success(`Eliminaste "${song.title}"`);
    }
  } catch (e) {
    deleteError.value = e instanceof AdminError ? e.message : "No se pudo eliminar la canción.";
  } finally {
    deleting.value = false;
  }
}

const deleteDescription = computed(() => {
  const song = toDelete.value;
  if (!song) return "";
  const tracks = song.audio_tracks?.length ?? 0;
  return `Se eliminan la letra y ${tracks === 1 ? "1 pista" : `${tracks} pistas`}, con sus audios. Quien tenga el enlace va a ver "Canción no encontrada".`;
});

const hasLyrics = (song: Song) => (song.lyrics?.length ?? 0) > 0;
</script>

<template>
  <SettingsSection title="Canciones" description="Arrastrá para ordenar.">
    <template #actions>
      <RouterLink :to="`/${props.collection.slug}/nueva`" class="btn btn-soft btn-sm">
        <IconPlus class="size-4" /> Nueva canción
      </RouterLink>
    </template>

    <div
      v-if="list.length === 0"
      class="bg-base-100 rounded-box border-base-content/10 text-base-content/60 border p-8 text-center"
    >
      Esta colección todavía no tiene canciones.
    </div>

    <ol
      v-else
      class="bg-base-100 rounded-box border-base-content/10 flex flex-col border p-1.5"
      data-testid="songs-list"
    >
      <li
        v-for="(song, index) in list"
        :key="song.id"
        class="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors"
        :class="{
          'bg-collection-soft outline-collection-ink outline-2': overIndex === index && dragIndex !== index,
          'opacity-40': dragIndex === index
        }"
        draggable="true"
        :data-testid="`song-row-${song.slug}`"
        @dragstart="dragIndex = index"
        @dragend="
          dragIndex = null;
          overIndex = null;
        "
        @dragover.prevent="overIndex = index"
        @drop.prevent="onDrop(index)"
      >
        <IconDragHandle class="text-base-content/40 size-4 shrink-0 cursor-grab" />
        <span class="text-base-content/50 w-5 text-right font-mono text-xs">{{ index + 1 }}</span>
        <span class="flex min-w-0 flex-1 items-center gap-1.5 font-semibold">
          <IconLock v-if="!song.visible" class="text-base-content/50 size-3.5 shrink-0" />
          <span class="truncate" :class="{ 'text-base-content/60': !song.visible }">{{ song.title }}</span>
        </span>
        <span class="badge badge-sm badge-ghost hidden sm:inline-flex">
          {{ song.audio_tracks?.length ?? 0 }} {{ song.audio_tracks?.length === 1 ? "pista" : "pistas" }}
        </span>
        <span
          class="badge badge-sm badge-soft hidden gap-1 sm:inline-flex"
          :class="hasLyrics(song) ? 'badge-success' : 'badge-warning'"
        >
          <IconLyrics v-if="hasLyrics(song)" class="size-3" />
          {{ hasLyrics(song) ? "Letra" : "Sin letra" }}
        </span>
        <span class="text-base-content/70 hidden w-12 text-right font-mono text-sm md:inline">{{
          song.duration ? formatTime(song.duration) : "—"
        }}</span>
        <input
          type="checkbox"
          class="toggle toggle-primary toggle-sm"
          :checked="song.visible"
          :aria-label="song.visible ? 'Ocultar canción' : 'Mostrar canción'"
          :title="song.visible ? 'Visible para todos' : 'Oculta: solo la ven editores y admins'"
          @change="toggleVisible(song)"
        />
        <div class="dropdown dropdown-end">
          <button tabindex="0" class="btn btn-ghost btn-sm btn-square" aria-label="Más acciones">
            <IconMore class="size-4" />
          </button>
          <ul tabindex="0" class="dropdown-content menu glass-3 rounded-box z-30 w-56 p-1.5">
            <li>
              <RouterLink
                :to="{
                  name: 'song',
                  params: { collectionSlug: props.collection.slug, songSlug: song.slug },
                  query: { editar: 'cancion' }
                }"
                ><IconEdit class="size-4" /> Editar canción</RouterLink
              >
            </li>
            <li>
              <button @click="copyLink(song)"><IconCopy class="size-4" /> Copiar enlace</button>
            </li>
            <li v-if="index > 0">
              <button @click="move(index, -1)"><IconMoveUp class="size-4" /> Subir</button>
            </li>
            <li v-if="index < list.length - 1">
              <button @click="move(index, 1)"><IconMoveDown class="size-4" /> Bajar</button>
            </li>
            <div class="border-base-content/10 my-1 border-t" />
            <li>
              <button class="text-error" @click="toDelete = song">
                <IconTrash class="size-4" /> Eliminar canción…
              </button>
            </li>
          </ul>
        </div>
      </li>
    </ol>

    <ConfirmTypedDialog
      :open="!!toDelete"
      :title="`Eliminar ${toDelete?.title ?? ''}`"
      :description="deleteDescription"
      :expected="toDelete?.title ?? ''"
      confirm-label="Eliminar canción"
      :busy="deleting"
      :error="deleteError"
      @confirm="confirmDelete"
      @cancel="
        toDelete = null;
        deleteError = '';
      "
    />
  </SettingsSection>
</template>
