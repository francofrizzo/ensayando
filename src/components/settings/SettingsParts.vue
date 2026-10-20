<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { toast } from "vue-sonner";

import ColorPreview from "@/components/settings/ColorPreview.vue";
import HueSlider from "@/components/settings/HueSlider.vue";
import SaveBar from "@/components/settings/SaveBar.vue";
import SegmentedControl from "@/components/settings/SegmentedControl.vue";
import SettingsSection from "@/components/settings/SettingsSection.vue";
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconEdit,
  IconGoTo,
  IconMore,
  IconPlus,
  IconTrash
} from "@/components/ui/icons";
import { useSettingsSection } from "@/composables/useSettingsGuard";
import { useDialogFocus } from "@/composables/useDialogFocus";
import { useTheme } from "@/composables/useTheme";
import { fetchCollectionParts, updateCollectionMusic } from "@/data/parts";
import type { CollectionPart, CollectionWithRole, Song } from "@/data/types";
import {
  COLOR_KEY_PATTERN,
  colorConflicts,
  colorKeyFromName,
  colorUsage,
  usageLabel,
  nearestFreeHue
} from "@/utils/collectionSettings";
import {
  deriveColor,
  isNeutral,
  normalizeHue,
  resolveCollectionPalette,
  TRACK_COLOR_NAME_MAX,
  withTrackColorName,
  type ColorSpec,
  type Intensity
} from "@/utils/palette";

const props = defineProps<{
  collection: CollectionWithRole;
  songs?: Song[];
  songsLoaded?: boolean;
}>();
const emit = defineEmits<{ updated: [collection: CollectionWithRole]; "songs-changed": [] }>();
type PaletteRow = { key: string; originalKey: string | null; name: string; spec: ColorSpec };
const { resolvedTheme } = useTheme();
const rows = ref<CollectionPart[]>([]);
const colors = ref<PaletteRow[]>([]);
const hue = ref(props.collection.hue);
const intensity = ref(props.collection.intensity);
const saved = ref("");
const loaded = ref(false);
const loading = ref(true);
const saving = ref(false);
const error = ref("");
const selectedId = ref<string | null>(null);
const collapsed = ref(new Set<string>());
const menuId = ref<string | null>(null);
const removing = ref<string | null>(null);
const removedColors = ref<{ key: string; replacement: string }[]>([]);
const colorEditor = ref<string | null>(null);
const chooser = ref<HTMLDetailsElement | null>(null);
const parentInput = ref<HTMLSelectElement | null>(null);
const nameInput = ref<HTMLInputElement | null>(null);
const removeDialog = ref<HTMLElement | null>(null);
useDialogFocus({
  open: computed(() => removing.value !== null),
  container: removeDialog,
  onClose: () => {
    removing.value = null;
  }
});
const snapshot = () =>
  JSON.stringify({
    rows: rows.value,
    colors: colors.value,
    hue: hue.value,
    intensity: intensity.value,
    removed: removedColors.value
  });
const dirty = computed(() => loaded.value && snapshot() !== saved.value);
const selected = computed(() => rows.value.find((row) => row.id === selectedId.value));
const editedColor = computed(() =>
  colors.value.find((color) => `color:${color.key}` === colorEditor.value)
);
const sharedUsage = computed(() => {
  const color = editedColor.value;
  if (!color) return "";
  const count = rows.value.filter((part) => resolvedKey(part.color_key) === color.key).length;
  return [
    count ? `${count} ${count === 1 ? "parte" : "partes"}` : "",
    props.songsLoaded
      ? usageLabel(colorUsage(props.songs ?? [])[color.originalKey ?? color.key])
      : ""
  ]
    .filter(Boolean)
    .join(" · ");
});
const themeSpec = computed<ColorSpec>(() => ({ hue: hue.value, intensity: intensity.value }));
const swatch = (spec: ColorSpec) => deriveColor(spec, "stage", resolvedTheme.value);
const resolvedKey = (key: string) =>
  removedColors.value.find((color) => color.key === key)?.replacement ?? key;
const colorFor = (key: string) => colors.value.find((color) => color.key === resolvedKey(key));
const colorName = (color: PaletteRow) => color.name.trim() || color.key;
const colorStyle = (key: string) => {
  const color = colorFor(key);
  return color ? { background: swatch(color.spec) } : {};
};
const INTENSITIES: { value: Intensity; label: string }[] = [
  { value: "suave", label: "Suave" },
  { value: "media", label: "Media" },
  { value: "intensa", label: "Intensa" }
];

function parentOptions(row: CollectionPart) {
  return rows.value.filter((candidate) => {
    const seen = new Set([row.id]);
    let current: CollectionPart | undefined = candidate;
    while (current) {
      if (seen.has(current.id)) return false;
      seen.add(current.id);
      current = rows.value.find((part) => part.id === current?.parent_id);
    }
    return true;
  });
}
const tree = computed(() => {
  const result: { part: CollectionPart; depth: number; children: boolean }[] = [];
  function visit(parent: string | null, depth: number) {
    for (const part of rows.value.filter((row) => row.parent_id === parent)) {
      const children = rows.value.some((row) => row.parent_id === part.id);
      result.push({ part, depth, children });
      if (!collapsed.value.has(part.id)) visit(part.id, depth + 1);
    }
  }
  visit(null, 0);
  return result;
});
const invalid = computed(
  () =>
    rows.value.some(
      (row) =>
        !row.name.trim() ||
        row.name.trim().length > 80 ||
        !colorFor(row.color_key) ||
        (row.parent_id !== null && !parentOptions(row).some((part) => part.id === row.parent_id))
    ) ||
    colors.value.some(
      (color, index) =>
        !COLOR_KEY_PATTERN.test(color.key) ||
        colors.value.findIndex((other) => other.key === color.key) !== index
    ) ||
    removedColors.value.some((removed) => !colorFor(removed.replacement))
);
const conflicts = computed(() =>
  colorConflicts(
    colors.value.map((color) => ({ key: color.key, name: colorName(color), spec: color.spec }))
  )
);
const colorConflict = computed(() =>
  conflicts.value.find(
    (conflict) => conflict.a === editedColor.value?.key || conflict.b === editedColor.value?.key
  )
);
const conflictName = computed(() => {
  const other =
    colorConflict.value?.a === editedColor.value?.key
      ? colorConflict.value?.b
      : colorConflict.value?.a;
  return colors.value.find((color) => color.key === other)?.name || other;
});
const marks = computed(() =>
  colors.value
    .filter((color) => color.key !== editedColor.value?.key && !isNeutral(color.spec))
    .map((color) => ({ hue: (color.spec as { hue: number }).hue, label: colorName(color) }))
);

async function load() {
  loading.value = true;
  error.value = "";
  try {
    rows.value = await fetchCollectionParts(props.collection.id);
    const palette = resolveCollectionPalette(props.collection);
    colors.value = Object.entries(palette.tracks).map(([key, spec]) => ({
      key,
      originalKey: key,
      name: palette.names[key] ?? "",
      spec: { ...spec }
    }));
    selectedId.value = rows.value[0]?.id ?? null;
    loaded.value = true;
    saved.value = snapshot();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function add(parentId: string | null = null) {
  const part: CollectionPart = {
    id: crypto.randomUUID(),
    collection_id: props.collection.id,
    name: "",
    color_key:
      rows.value.find((part) => part.id === parentId)?.color_key ??
      selected.value?.color_key ??
      colors.value[0]?.key ??
      "",
    parent_id: parentId,
    order: rows.value.length
  };
  rows.value.push(part);
  if (parentId) collapsed.value.delete(parentId);
  selectedId.value = part.id;
  colorEditor.value = null;
  menuId.value = null;
  await nextTick();
  nameInput.value?.focus();
}
function toggle(id: string) {
  if (collapsed.value.has(id)) collapsed.value.delete(id);
  else collapsed.value.add(id);
}
async function move(part: CollectionPart) {
  selectedId.value = part.id;
  menuId.value = null;
  await nextTick();
  parentInput.value?.focus();
}
function removePart() {
  rows.value = rows.value.filter((part) => part.id !== removing.value);
  if (!rows.value.some((part) => part.id === selectedId.value))
    selectedId.value = rows.value[0]?.id ?? null;
  removing.value = null;
}
function chooseColor(key: string) {
  if (selected.value) selected.value.color_key = key;
  if (chooser.value) chooser.value.open = false;
}
function editColor(key: string) {
  colorEditor.value = `color:${resolvedKey(key)}`;
  if (chooser.value) chooser.value.open = false;
}
function addColor(assignToPart = false) {
  const key = colorKeyFromName(
    "color",
    colors.value.map((color) => color.key)
  );
  const freeHue =
    nearestFreeHue(
      (hue.value + 180) % 360,
      "media",
      colors.value.map((color) => color.spec)
    ) ?? 0;
  colors.value.push({
    key,
    originalKey: null,
    name: "",
    spec: { hue: freeHue, intensity: "media" }
  });
  if (assignToPart && selected.value) selected.value.color_key = key;
  editColor(key);
}
function setHue(value: number) {
  if (colorEditor.value === "theme") hue.value = normalizeHue(value);
  else if (editedColor.value && !isNeutral(editedColor.value.spec))
    editedColor.value.spec = { ...editedColor.value.spec, hue: normalizeHue(value) };
}
function setIntensity(value: Intensity) {
  if (colorEditor.value === "theme") intensity.value = value;
  else if (editedColor.value && !isNeutral(editedColor.value.spec))
    editedColor.value.spec = { ...editedColor.value.spec, intensity: value };
}
function setNeutral(value: boolean) {
  if (editedColor.value)
    editedColor.value.spec = value ? { neutral: true } : { hue: hue.value, intensity: "media" };
}
function renameColor(event: Event) {
  const color = editedColor.value;
  if (!color) return;
  const oldKey = color.key;
  const key = (event.target as HTMLInputElement).value.trim();
  for (const part of rows.value) if (part.color_key === oldKey) part.color_key = key;
  for (const removed of removedColors.value)
    if (removed.replacement === oldKey) removed.replacement = key;
  color.key = key;
  colorEditor.value = `color:${key}`;
}
function removeColor() {
  const color = editedColor.value;
  if (!color || colors.value.length < 2 || !props.songsLoaded) return;
  const replacement = colors.value.find((other) => other !== color)!.key;
  for (const removed of removedColors.value)
    if (removed.replacement === color.key) removed.replacement = replacement;
  // Keep original references until save so changing a replacement affects only
  // the parts that used this color, not parts already using the destination.
  for (const part of rows.value)
    if (part.color_key === color.key) part.color_key = color.originalKey ?? replacement;
  if (color.originalKey) removedColors.value.push({ key: color.originalKey, replacement });
  colors.value = colors.value.filter((other) => other !== color);
  editColor(replacement);
}
function discard() {
  if (saving.value || !loaded.value) return;
  const state = JSON.parse(saved.value);
  rows.value = state.rows;
  colors.value = state.colors;
  hue.value = state.hue;
  intensity.value = state.intensity;
  removedColors.value = state.removed;
  selectedId.value = rows.value[0]?.id ?? null;
  colorEditor.value = null;
  error.value = "";
}
async function save() {
  if (saving.value || !loaded.value || invalid.value || !dirty.value || !props.songsLoaded) return;
  saving.value = true;
  error.value = "";
  try {
    const keyMap = Object.fromEntries(
      removedColors.value.map((removed) => [removed.key, removed.replacement])
    );
    for (const color of colors.value)
      if (color.originalKey && color.key !== color.originalKey)
        keyMap[color.originalKey] = color.key;
    const trackColors = Object.fromEntries(
      colors.value.map((color) => [color.key, withTrackColorName(color.spec, color.name)])
    );
    const parts = rows.value.map((part, order) => ({
      ...part,
      name: part.name.trim(),
      color_key: resolvedKey(part.color_key),
      order
    }));
    await updateCollectionMusic(props.collection.id, parts, {
      hue: hue.value,
      intensity: intensity.value,
      trackColors,
      keyMap
    });
    // The RPC is atomic: only commit the local snapshot once all writes succeed.
    rows.value = parts;
    colors.value = colors.value.map((color) => ({
      ...color,
      name: color.name.trim(),
      originalKey: color.key
    }));
    removedColors.value = [];
    saved.value = snapshot();
    emit("updated", {
      ...props.collection,
      hue: hue.value,
      intensity: intensity.value,
      track_colors: trackColors,
      parts: rows.value.map((part) => ({ ...part }))
    });
    emit("songs-changed");
    toast.success("Cambios guardados");
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}
useSettingsSection({
  label: "las partes y los colores",
  isDirty: () => dirty.value,
  save,
  discard,
  canSave: () => loaded.value && !invalid.value && !saving.value && !!props.songsLoaded
});
</script>

<template>
  <SettingsSection title="Partes y colores" @click="menuId = null" @keydown.esc="menuId = null">
    <template #actions>
      <button
        v-if="colorEditor"
        class="btn btn-soft btn-sm"
        :disabled="!loaded || saving"
        @click="addColor()"
      >
        <IconPlus class="size-4" /> Agregar color
      </button>
      <button
        v-else
        class="btn btn-soft btn-sm"
        data-testid="add-part"
        :disabled="!loaded || saving || !colors.length"
        @click="add()"
      >
        <IconPlus class="size-4" /> Agregar parte
      </button>
    </template>
    <p v-if="loading" role="status">Cargando partes…</p>
    <fieldset
      v-else
      :disabled="saving || !loaded"
      class="grid min-w-0 items-start gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]"
    >
      <div class="bg-base-100 border-base-content/10 rounded-box flex min-w-0 flex-col border">
        <div class="p-3">
          <SegmentedControl
            :model-value="colorEditor ? 'colors' : 'parts'"
            :options="[
              { value: 'parts', label: 'Partes' },
              { value: 'colors', label: 'Colores' }
            ]"
            label="Editar partes o colores"
            stretch
            @update:model-value="
              colorEditor =
                $event === 'parts' ? null : colors[0] ? `color:${colors[0].key}` : 'theme'
            "
          />
        </div>
        <div v-if="!colorEditor" class="p-2 pt-0" role="group" aria-label="Partes musicales">
          <p v-if="!rows.length" class="text-base-content/60 p-3 text-sm">Todavía no hay partes.</p>
          <div
            v-for="entry in tree"
            :key="entry.part.id"
            class="relative flex items-center gap-1 rounded-lg"
            :class="selectedId === entry.part.id ? 'bg-collection-soft' : 'hover:bg-base-content/5'"
            :data-testid="`part-row-${entry.part.id}`"
          >
            <div
              class="flex min-w-0 flex-1 items-center"
              :style="{ marginLeft: `${entry.depth * 20}px` }"
              :class="entry.depth ? 'border-base-content/20 border-l' : ''"
            >
              <button
                v-if="entry.children"
                class="btn btn-ghost btn-xs btn-square shrink-0"
                :aria-label="`${collapsed.has(entry.part.id) ? 'Expandir' : 'Contraer'} ${entry.part.name}`"
                :aria-expanded="!collapsed.has(entry.part.id)"
                @click="toggle(entry.part.id)"
              >
                <IconChevronRight
                  v-if="collapsed.has(entry.part.id)"
                  class="size-4"
                /><IconChevronDown v-else class="size-4" />
              </button>
              <span v-else class="w-6 shrink-0" aria-hidden="true" />
              <button
                class="flex min-w-0 flex-1 items-center gap-3 py-3 text-left text-sm font-semibold"
                :aria-pressed="selectedId === entry.part.id"
                @click="
                  selectedId = entry.part.id;
                  menuId = null;
                "
              >
                <span
                  class="size-4 shrink-0 rounded-full"
                  :style="colorStyle(entry.part.color_key)"
                />
                <span class="truncate">{{ entry.part.name || "Nueva parte" }}</span>
              </button>
            </div>
            <div
              class="dropdown dropdown-end"
              :class="{ 'dropdown-open': menuId === entry.part.id }"
              @click.stop
            >
              <button
                class="btn btn-ghost btn-sm btn-square"
                :aria-label="`Acciones de ${entry.part.name || 'nueva parte'}`"
                :aria-expanded="menuId === entry.part.id"
                @click="menuId = menuId === entry.part.id ? null : entry.part.id"
              >
                <IconMore class="size-4" />
              </button>
              <ul
                v-if="menuId === entry.part.id"
                class="dropdown-content menu glass-3 rounded-box z-30 w-52 p-2"
                @keydown.esc="menuId = null"
              >
                <li>
                  <button @click="add(entry.part.id)">
                    <IconPlus class="size-4" /> Agregar subdivisión
                  </button>
                </li>
                <li>
                  <button @click="move(entry.part)"><IconGoTo class="size-4" /> Mover</button>
                </li>
                <li>
                  <button
                    class="text-error"
                    :disabled="entry.children"
                    @click="
                      removing = entry.part.id;
                      menuId = null;
                    "
                  >
                    <IconTrash class="size-4" /> Eliminar
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div
          v-else
          class="max-h-64 overflow-y-auto p-2 pt-0"
          role="group"
          aria-label="Colores de la colección"
        >
          <button
            v-for="color in colors"
            :key="color.key"
            class="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm"
            :class="editedColor === color ? 'bg-collection-soft' : 'hover:bg-base-content/5'"
            :aria-pressed="editedColor === color"
            @click="editColor(color.key)"
          >
            <span
              class="size-5 shrink-0 rounded-full"
              :style="{ background: swatch(color.spec) }"
            />
            <span class="min-w-0 flex-1 truncate font-semibold">{{ colorName(color) }}</span>
            <span class="text-base-content/60 font-mono text-xs">{{ color.key }}</span>
          </button>
        </div>
        <div class="border-base-content/10 mt-auto flex items-center gap-3 border-t p-4">
          <span class="size-5 shrink-0 rounded-full" :style="{ background: swatch(themeSpec) }" />
          <span class="flex-1 text-sm font-semibold">Color de colección</span>
          <button
            class="btn btn-ghost btn-sm btn-square"
            aria-label="Editar color de colección"
            @click="colorEditor = 'theme'"
          >
            <IconEdit class="size-4" />
          </button>
        </div>
      </div>
      <div
        class="bg-base-100 border-base-content/10 rounded-box flex min-w-0 flex-col gap-5 border p-5"
      >
        <template v-if="!colorEditor && selected">
          <label class="flex flex-col gap-1.5 text-sm font-semibold"
            >Nombre<input
              ref="nameInput"
              v-model="selected.name"
              class="input field-focus w-full"
              maxlength="80"
              aria-label="Nombre de parte"
          /></label>
          <label class="flex flex-col gap-1.5 text-sm font-semibold"
            >Dentro de<select
              ref="parentInput"
              v-model="selected.parent_id"
              class="select field-focus w-full"
              aria-label="Dentro de"
            >
              <option :value="null">Ninguna</option>
              <option v-for="parent in parentOptions(selected)" :key="parent.id" :value="parent.id">
                {{ parent.name || "Nueva parte" }}
              </option>
            </select></label
          >
          <div class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">Color</span>
            <details
              ref="chooser"
              class="dropdown w-full"
              @keydown.esc="chooser && (chooser.open = false)"
            >
              <summary class="btn btn-soft flex w-full justify-start" aria-label="Elegir color">
                <span class="size-5 rounded-full" :style="colorStyle(selected.color_key)" /><span
                  class="flex-1 truncate text-left"
                  >{{
                    colorFor(selected.color_key)
                      ? colorName(colorFor(selected.color_key)!)
                      : "Elegí un color"
                  }}</span
                ><IconChevronDown class="size-4" />
              </summary>
              <div class="dropdown-content glass-3 rounded-box z-20 mt-1 w-full min-w-48 p-2">
                <div class="max-h-52 overflow-y-auto" role="group" aria-label="Paleta">
                  <button
                    v-for="color in colors"
                    :key="color.key"
                    class="hover:bg-base-content/5 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm"
                    :aria-pressed="selected.color_key === color.key"
                    @click="chooseColor(color.key)"
                  >
                    <span
                      class="size-5 shrink-0 rounded-full"
                      :style="{ background: swatch(color.spec) }"
                    /><span class="flex-1 truncate">{{ colorName(color) }}</span
                    ><IconCheck v-if="selected.color_key === color.key" class="size-4" />
                  </button>
                </div>
                <div class="border-base-content/10 mt-1 flex flex-col border-t pt-1">
                  <button
                    class="btn btn-ghost btn-sm justify-start"
                    @click="editColor(selected.color_key)"
                  >
                    <IconEdit class="size-4" /> Editar color
                  </button>
                  <button
                    class="btn btn-ghost btn-sm justify-start"
                    data-testid="add-color"
                    @click="addColor(true)"
                  >
                    <IconPlus class="size-4" /> Nuevo color
                  </button>
                </div>
              </div>
            </details>
          </div>
        </template>
        <template v-if="colorEditor">
          <h2 v-if="colorEditor === 'theme'" class="font-display text-xl font-bold">
            Color de colección
          </h2>
          <label v-if="editedColor" class="flex flex-col gap-1 text-sm font-semibold"
            >Nombre<input
              v-model="editedColor.name"
              class="input field-focus w-full"
              :maxlength="TRACK_COLOR_NAME_MAX"
              aria-label="Nombre de color"
          /></label>
          <p v-if="sharedUsage" class="text-base-content/60 text-xs">{{ sharedUsage }}</p>
          <template v-if="colorEditor === 'theme' || editedColor">
            <div class="flex items-center gap-3">
              <div class="min-w-0 flex-1">
                <span class="mb-1 block text-sm font-semibold">Tono</span
                ><HueSlider
                  :model-value="
                    colorEditor === 'theme'
                      ? hue
                      : isNeutral(editedColor!.spec)
                        ? 0
                        : editedColor!.spec.hue
                  "
                  :intensity="
                    colorEditor === 'theme'
                      ? intensity
                      : isNeutral(editedColor!.spec)
                        ? 'media'
                        : editedColor!.spec.intensity
                  "
                  :marks="colorEditor === 'theme' ? [] : marks"
                  :disabled="!!editedColor && isNeutral(editedColor.spec)"
                  @update:model-value="setHue"
                />
              </div>
              <input
                class="input input-sm field-focus w-20 font-mono"
                type="number"
                aria-label="Tono en grados"
                :value="
                  colorEditor === 'theme'
                    ? hue
                    : isNeutral(editedColor!.spec)
                      ? ''
                      : editedColor!.spec.hue
                "
                :disabled="!!editedColor && isNeutral(editedColor.spec)"
                @change="setHue(Number(($event.target as HTMLInputElement).value))"
              />
            </div>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <SegmentedControl
                :model-value="
                  colorEditor === 'theme'
                    ? intensity
                    : isNeutral(editedColor!.spec)
                      ? 'media'
                      : editedColor!.spec.intensity
                "
                :options="INTENSITIES"
                label="Intensidad"
                :disabled="!!editedColor && isNeutral(editedColor.spec)"
                @update:model-value="setIntensity"
              /><label v-if="editedColor" class="flex items-center gap-2 text-sm"
                ><input
                  type="checkbox"
                  class="toggle toggle-sm"
                  :checked="isNeutral(editedColor.spec)"
                  @change="setNeutral(($event.target as HTMLInputElement).checked)"
                />Neutro</label
              >
            </div>
            <p v-if="colorConflict" class="text-warning text-sm">Parecido a {{ conflictName }}.</p>
            <ColorPreview :spec="editedColor?.spec ?? themeSpec" :collection-hue="hue" />
          </template>
          <details v-if="editedColor" class="text-sm">
            <summary class="text-base-content/60 cursor-pointer">Avanzado</summary>
            <label class="mt-3 flex flex-col gap-1"
              >Clave<input
                :value="editedColor.key"
                aria-label="Clave de color"
                class="input input-sm field-focus font-mono"
                @input="renameColor" /></label
            ><button
              class="btn btn-ghost btn-sm text-error mt-2"
              :disabled="colors.length < 2 || !props.songsLoaded"
              @click="removeColor"
            >
              <IconTrash class="size-4" />Eliminar color
            </button>
          </details>
        </template>
      </div>
    </fieldset>
    <div
      v-for="removed in removedColors"
      :key="removed.key"
      class="alert alert-warning alert-soft text-sm"
    >
      <span>Reemplazar {{ removed.key }}</span
      ><select
        v-model="removed.replacement"
        class="select select-sm"
        :aria-label="`Reemplazo de ${removed.key}`"
      >
        <option v-for="color in colors" :key="color.key" :value="color.key">
          {{ colorName(color) }}
        </option>
      </select>
    </div>
    <p v-if="invalid && dirty" class="text-warning text-sm">
      Revisá los nombres, los colores y las subdivisiones.
    </p>
    <div v-if="error" role="alert" class="text-error text-sm">
      {{ error }} <button v-if="!loaded && !loading" class="link" @click="load">Reintentar</button>
    </div>
    <SaveBar
      v-if="dirty"
      label="Cambios sin guardar"
      :saving="saving"
      :disabled="invalid || !props.songsLoaded"
      @save="save"
      @discard="discard"
    />

    <div
      v-if="removing"
      class="modal modal-open"
      role="dialog"
      aria-modal="true"
      aria-label="Eliminar parte"
      @keydown.esc="removing = null"
    >
      <div ref="removeDialog" class="modal-box max-w-sm">
        <h2 class="font-display text-xl font-bold">
          ¿Eliminar {{ rows.find((part) => part.id === removing)?.name || "esta parte" }}?
        </h2>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="removing = null">Cancelar</button
          ><button class="btn btn-error" @click="removePart">Eliminar</button>
        </div>
      </div>
      <button class="modal-backdrop" aria-label="Cancelar" @click="removing = null" />
    </div>
  </SettingsSection>
</template>
