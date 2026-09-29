<script setup lang="ts">
import { computed, ref } from "vue";
import { toast } from "vue-sonner";

import ColorPreview from "@/components/settings/ColorPreview.vue";
import HueSlider from "@/components/settings/HueSlider.vue";
import SaveBar from "@/components/settings/SaveBar.vue";
import SegmentedControl from "@/components/settings/SegmentedControl.vue";
import SettingsSection from "@/components/settings/SettingsSection.vue";
import { IconPlus, IconTrash, IconWarning } from "@/components/ui/icons";
import { useSettingsSection } from "@/composables/useSettingsGuard";
import { useTheme } from "@/composables/useTheme";
import { AdminError, updateCollectionPalette } from "@/data/admin";
import type { CollectionWithRole, Song } from "@/data/types";
import {
  COLOR_KEY_PATTERN,
  colorKeyFromName,
  colorUsage,
  competingHues,
  describeColorChange,
  hueConflicts,
  hueDistance,
  intensitiesClash,
  MIN_HUE_DISTANCE,
  nearestFreeHue,
  usageLabel
} from "@/utils/collectionSettings";
import {
  type ColorSpec,
  deriveColor,
  type Intensity,
  isNeutral,
  normalizeHue,
  resolveCollectionPalette,
  TRACK_COLOR_NAME_MAX,
  withTrackColorName
} from "@/utils/palette";

const props = defineProps<{
  collection: CollectionWithRole;
  songs: Song[];
  /** Whether `songs` are this collection's: until then usage (and removals) can't be known. */
  songsLoaded: boolean;
}>();
const emit = defineEmits<{ updated: [collection: CollectionWithRole]; "songs-changed": [] }>();

const { resolvedTheme } = useTheme();

/** `name` is what the collection calls this track ("Voz 1"); empty falls back to the tracks' titles. */
type Row = { uid: number; originalKey: string | null; key: string; name: string; spec: ColorSpec };
type Removed = { originalKey: string; replacement: string };

let nextUid = 1;
function initialRows(): Row[] {
  const palette = resolveCollectionPalette(props.collection);
  return Object.entries(palette.tracks).map(([key, spec]) => ({
    uid: nextUid++,
    originalKey: key,
    key,
    name: palette.names[key] ?? "",
    spec: { ...spec }
  }));
}

const savedRows = ref<Row[]>(initialRows());
const rows = ref<Row[]>(savedRows.value.map((r) => ({ ...r, spec: { ...r.spec } })));
const mainHue = ref(props.collection.hue);
const mainIntensity = ref<Intensity>(props.collection.intensity);
const removed = ref<Removed[]>([]);
const selected = ref<number | "main">("main");
const saving = ref(false);
const error = ref("");

const usage = computed(() => colorUsage(props.songs));

// Each color has a name: the one given here, or else the most common title of the
// tracks using it ("Bajo" reads better than "baj"), or the key itself.
const labels = computed(() => {
  const counts: Record<string, Record<string, number>> = {};
  for (const song of props.songs) {
    for (const track of song.audio_tracks ?? []) {
      counts[track.color_key] ??= {};
      counts[track.color_key]![track.title] = (counts[track.color_key]![track.title] ?? 0) + 1;
    }
  }
  const out: Record<string, string> = {};
  for (const [key, titles] of Object.entries(counts)) {
    out[key] = Object.entries(titles).sort((a, b) => b[1] - a[1])[0]![0];
  }
  return out;
});
const derivedLabel = (row: Row) => labels.value[row.originalKey ?? ""] ?? row.key;
const labelFor = (row: Row) => row.name.trim() || derivedLabel(row);
const usageFor = (row: Row) => (row.originalKey ? usage.value[row.originalKey] : undefined);

const selectedRow = computed(() =>
  selected.value === "main" ? null : (rows.value.find((r) => r.uid === selected.value) ?? null)
);

const conflicts = computed(() =>
  hueConflicts(rows.value.map((r) => ({ key: String(r.uid), name: labelFor(r), spec: r.spec })))
);
const conflictFor = (row: Row) =>
  conflicts.value.find((c) => c.a === String(row.uid) || c.b === String(row.uid));
const conflictPartner = (row: Row) => {
  const c = conflictFor(row);
  if (!c) return null;
  const otherUid = Number(c.a === String(row.uid) ? c.b : c.a);
  return rows.value.find((r) => r.uid === otherUid) ?? null;
};

const swatch = (spec: ColorSpec) => deriveColor(spec, "fill", resolvedTheme.value);
const specLabel = (spec: ColorSpec) =>
  isNeutral(spec) ? { hue: "—", intensity: "neutra" } : { hue: `${spec.hue}°`, intensity: spec.intensity };

const marksFor = (row: Row | null) =>
  rows.value
    .filter((r) => r !== row && !isNeutral(r.spec))
    .map((r) => ({
      hue: (r.spec as { hue: number }).hue,
      label: labelFor(r),
      warn:
        !!row &&
        !isNeutral(row.spec) &&
        hueDistance((r.spec as { hue: number }).hue, row.spec.hue) < MIN_HUE_DISTANCE &&
        intensitiesClash((r.spec as { intensity: Intensity }).intensity, row.spec.intensity)
    }));

function setHue(row: Row, hue: number) {
  if (isNeutral(row.spec)) return;
  row.spec = { hue, intensity: row.spec.intensity };
}
function setIntensity(row: Row, intensity: Intensity) {
  if (isNeutral(row.spec)) return;
  row.spec = { hue: row.spec.hue, intensity };
}
function setNeutral(row: Row, neutral: boolean) {
  if (neutral) row.spec = { neutral: true };
  else {
    const others = rows.value.filter((r) => r !== row).map((r) => r.spec);
    const hue = nearestFreeHue(mainHue.value + 180, competingHues("media", others));
    row.spec = { hue: hue ?? 0, intensity: "media" };
  }
}

const suggestion = computed(() => {
  const row = selectedRow.value;
  if (!row || isNeutral(row.spec) || !conflictFor(row)) return null;
  const others = rows.value.filter((r) => r !== row).map((r) => r.spec);
  return nearestFreeHue(row.spec.hue, competingHues(row.spec.intensity, others));
});

function addColor() {
  const taken = rows.value.map((r) => r.key);
  const others = rows.value.map((r) => r.spec);
  const hue = nearestFreeHue((mainHue.value + 180) % 360, competingHues("media", others)) ?? 0;
  const row: Row = {
    uid: nextUid++,
    originalKey: null,
    key: colorKeyFromName("color", taken),
    name: "",
    spec: { hue, intensity: "media" }
  };
  rows.value.push(row);
  selected.value = row.uid;
}

function removeRow(row: Row) {
  // Without the songs we can't tell whether a color is in use (and needs a replacement).
  if (!props.songsLoaded) return;
  const inUse = (usageFor(row)?.tracks ?? 0) + (usageFor(row)?.verses ?? 0) > 0;
  rows.value = rows.value.filter((r) => r !== row);
  if (row.originalKey && inUse) {
    removed.value.push({ originalKey: row.originalKey, replacement: rows.value[0]?.key ?? "" });
  }
  selected.value = "main";
}

// ---------- changes ----------

const keyErrors = computed(() => {
  const errors: Record<number, string> = {};
  const seen = new Map<string, number>();
  for (const row of rows.value) {
    if (!COLOR_KEY_PATTERN.test(row.key)) {
      errors[row.uid] = "Minúsculas, números, guion o guion bajo (hasta 24).";
    } else if (seen.has(row.key)) {
      errors[row.uid] = "Ya hay otra pista con esa clave.";
    }
    seen.set(row.key, row.uid);
  }
  return errors;
});

const changeList = computed(() => {
  const list: string[] = [];
  if (mainHue.value !== props.collection.hue || mainIntensity.value !== props.collection.intensity) {
    list.push(
      describeColorChange(
        "Color principal",
        { hue: props.collection.hue, intensity: props.collection.intensity },
        { hue: mainHue.value, intensity: mainIntensity.value }
      )
    );
  }
  for (const row of rows.value) {
    const before = savedRows.value.find((r) => r.originalKey === row.originalKey && row.originalKey);
    if (!before) {
      list.push(`${row.key} nuevo`);
      continue;
    }
    if (row.key !== before.key) list.push(`${before.key} renombrado`);
    if (row.name.trim() !== before.name.trim()) {
      list.push(row.name.trim() ? `${before.key}: nombre “${row.name.trim()}”` : `${before.key}: sin nombre`);
    }
    if (JSON.stringify(row.spec) !== JSON.stringify(before.spec)) {
      list.push(describeColorChange(labelFor(row), before.spec, row.spec));
    }
  }
  for (const before of savedRows.value) {
    if (!rows.value.some((r) => r.originalKey === before.originalKey)) list.push(`${before.key} quitado`);
  }
  return list;
});

const saveLabel = computed(() => {
  const n = changeList.value.length;
  return `${n} ${n === 1 ? "cambio" : "cambios"}: ${changeList.value.join(", ")}`;
});

const blocked = computed(
  () =>
    !props.songsLoaded ||
    Object.keys(keyErrors.value).length > 0 ||
    removed.value.some((r) => !rows.value.some((row) => row.key === r.replacement))
);

async function save() {
  if (blocked.value) return;
  saving.value = true;
  error.value = "";
  const keyMap: Record<string, string> = {};
  for (const row of rows.value) {
    if (row.originalKey && row.originalKey !== row.key) keyMap[row.originalKey] = row.key;
  }
  for (const r of removed.value) keyMap[r.originalKey] = r.replacement;
  const trackColors = Object.fromEntries(
    rows.value.map((r) => [r.key, withTrackColorName(r.spec, r.name)])
  );
  try {
    await updateCollectionPalette(props.collection.id, {
      hue: mainHue.value,
      intensity: mainIntensity.value,
      trackColors,
      keyMap
    });
    emit("updated", {
      ...props.collection,
      hue: mainHue.value,
      intensity: mainIntensity.value,
      track_colors: trackColors
    });
    if (Object.keys(keyMap).length) emit("songs-changed");
    savedRows.value = rows.value.map((r) => ({
      ...r,
      name: r.name.trim(),
      originalKey: r.key,
      spec: { ...r.spec }
    }));
    rows.value = savedRows.value.map((r) => ({ ...r, spec: { ...r.spec } }));
    removed.value = [];
    toast.success("Pistas guardadas");
  } catch (e) {
    error.value = e instanceof AdminError ? e.message : "No se pudieron guardar las pistas.";
  } finally {
    saving.value = false;
  }
}

// Typed hues are rounded and wrapped into 0–359 (400 → 40); an empty field keeps the value.
function readHue(event: Event): number | null {
  const raw = (event.target as HTMLInputElement).value;
  const value = Number(raw);
  return raw.trim() === "" || !Number.isFinite(value) ? null : normalizeHue(value);
}
function onMainHueInput(event: Event) {
  const hue = readHue(event);
  if (hue !== null) mainHue.value = hue;
  (event.target as HTMLInputElement).value = String(mainHue.value);
}
function onRowHueInput(row: Row, event: Event) {
  const hue = readHue(event);
  if (hue !== null) setHue(row, hue);
  else if (!isNeutral(row.spec)) (event.target as HTMLInputElement).value = String(row.spec.hue);
}

function discard() {
  rows.value = savedRows.value.map((r) => ({ ...r, spec: { ...r.spec } }));
  mainHue.value = props.collection.hue;
  mainIntensity.value = props.collection.intensity;
  removed.value = [];
  error.value = "";
  selected.value = "main";
}

useSettingsSection({
  label: "las pistas",
  isDirty: () => changeList.value.length > 0,
  save,
  discard,
  canSave: () => !blocked.value && !saving.value
});

const INTENSITIES: { value: Intensity; label: string }[] = [
  { value: "suave", label: "Suave" },
  { value: "media", label: "Media" },
  { value: "intensa", label: "Intensa" }
];
const mainSpec = computed<ColorSpec>(() => ({ hue: mainHue.value, intensity: mainIntensity.value }));
</script>

<template>
  <SettingsSection title="Pistas">
    <template #actions>
      <button class="btn btn-soft btn-sm" data-testid="add-color" @click="addColor">
        <IconPlus class="size-4" /> Agregar pista
      </button>
    </template>

    <div class="grid gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <!-- list -->
      <div class="bg-base-100 rounded-box border-base-content/10 flex flex-col border p-2">
        <button
          class="flex items-center gap-3 rounded-lg p-2.5 text-left"
          :class="selected === 'main' ? 'bg-collection-soft' : 'hover:bg-base-content/5'"
          @click="selected = 'main'"
        >
          <span class="size-9 shrink-0 rounded-lg" :style="{ background: swatch(mainSpec) }" />
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="font-semibold">Color principal</span>
            <span class="text-base-content/50 font-mono text-xs">colección</span>
          </span>
          <span class="text-right font-mono text-xs leading-tight">
            {{ mainHue }}°<br /><span class="text-base-content/50">{{ mainIntensity }}</span>
          </span>
        </button>
        <div class="border-base-content/10 mx-2 my-1 border-t" />
        <button
          v-for="row in rows"
          :key="row.uid"
          class="flex items-center gap-3 rounded-lg p-2.5 text-left"
          :class="selected === row.uid ? 'bg-collection-soft' : 'hover:bg-base-content/5'"
          :data-testid="`color-row-${row.key}`"
          @click="selected = row.uid"
        >
          <span
            class="size-9 shrink-0 rounded-lg"
            :class="{ 'neutral-swatch': isNeutral(row.spec) }"
            :style="isNeutral(row.spec) ? {} : { background: swatch(row.spec) }"
          />
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="flex items-center gap-2 font-semibold">
              <span class="truncate">{{ labelFor(row) }}</span>
              <span v-if="conflictFor(row)" class="badge badge-warning badge-soft badge-xs gap-1">
                <IconWarning class="size-3" />{{ conflictFor(row)!.distance }}° de
                {{ labelFor(conflictPartner(row)!) }}
              </span>
            </span>
            <span class="text-base-content/50 truncate font-mono text-xs"
              >{{ row.key }} · {{ usageLabel(usageFor(row)) }}</span
            >
          </span>
          <span class="text-right font-mono text-xs leading-tight">
            {{ specLabel(row.spec).hue }}<br /><span class="text-base-content/50">{{
              specLabel(row.spec).intensity
            }}</span>
          </span>
        </button>
        <p v-if="rows.length === 0" class="text-base-content/50 p-3 text-sm">
          Todavía no hay pistas. Agregá una para darle nombre y color.
        </p>
      </div>

      <!-- editor -->
      <div class="bg-base-100 rounded-box border-base-content/10 flex flex-col gap-4 border p-5">
        <template v-if="!selectedRow">
          <div class="flex items-center gap-3">
            <span class="size-11 shrink-0 rounded-xl" :style="{ background: swatch(mainSpec) }" />
            <div class="flex flex-col">
              <span class="font-semibold">Color principal</span>
              <span class="text-base-content/60 text-sm">Luz de sala, botones y lo seleccionado.</span>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex-1">
              <span class="text-base-content/70 mb-1 block text-sm font-semibold">Tono</span>
              <HueSlider v-model="mainHue" :intensity="mainIntensity" label="Tono del color principal" />
            </div>
            <input
              :value="mainHue"
              type="number"
              min="0"
              max="359"
              class="input input-sm no-spinner w-20 font-mono field-focus"
              aria-label="Tono en grados"
              :disabled="!songsLoaded"
              @change="onMainHueInput"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <span class="text-base-content/70 text-sm font-semibold">Intensidad</span>
            <SegmentedControl v-model="mainIntensity" :options="INTENSITIES" label="Intensidad" />
          </div>
          <ColorPreview :spec="mainSpec" :collection-hue="mainHue" />
        </template>

        <template v-else>
          <div class="flex items-end gap-3">
            <span
              class="size-11 shrink-0 rounded-xl"
              :class="{ 'neutral-swatch': isNeutral(selectedRow.spec) }"
              :style="isNeutral(selectedRow.spec) ? {} : { background: swatch(selectedRow.spec) }"
            />
            <label class="flex min-w-0 flex-1 flex-col gap-1">
              <span class="text-base-content/70 text-sm font-semibold">Nombre</span>
              <input
                v-model="selectedRow.name"
                class="input input-sm field-focus"
                :placeholder="derivedLabel(selectedRow)"
                :maxlength="TRACK_COLOR_NAME_MAX"
                data-testid="color-name"
              />
            </label>
            <label class="flex w-32 flex-col gap-1">
              <span class="text-base-content/70 text-sm font-semibold">Clave</span>
              <input
                v-model.trim="selectedRow.key"
                class="input input-sm font-mono field-focus"
                :class="{ 'input-error': keyErrors[selectedRow.uid] }"
                autocapitalize="none"
                spellcheck="false"
              />
            </label>
            <button
              class="btn btn-ghost btn-sm btn-square text-error"
              aria-label="Quitar pista"
              :disabled="!songsLoaded"
              :title="songsLoaded ? undefined : 'Esperá a que carguen las canciones'"
              @click="removeRow(selectedRow)"
            >
              <IconTrash class="size-4" />
            </button>
          </div>
          <p v-if="keyErrors[selectedRow.uid]" class="text-error -mt-2 text-xs">
            {{ keyErrors[selectedRow.uid] }}
          </p>
          <p
            v-else-if="selectedRow.originalKey && selectedRow.key !== selectedRow.originalKey"
            class="text-base-content/60 -mt-2 text-xs"
          >
            Al guardar, las pistas y los versos que usan <span class="font-mono">{{ selectedRow.originalKey }}</span>
            pasan a <span class="font-mono">{{ selectedRow.key }}</span>.
          </p>

          <div class="flex items-center gap-3">
            <div class="flex-1">
              <span class="text-base-content/70 mb-1 block text-sm font-semibold">Tono</span>
              <HueSlider
                :model-value="isNeutral(selectedRow.spec) ? 0 : selectedRow.spec.hue"
                :intensity="isNeutral(selectedRow.spec) ? 'media' : selectedRow.spec.intensity"
                :marks="marksFor(selectedRow)"
                :disabled="isNeutral(selectedRow.spec)"
                @update:model-value="setHue(selectedRow, $event)"
              />
            </div>
            <input
              :value="isNeutral(selectedRow.spec) ? '' : selectedRow.spec.hue"
              type="number"
              min="0"
              max="359"
              class="input input-sm no-spinner w-20 font-mono field-focus"
              aria-label="Tono en grados"
              :disabled="isNeutral(selectedRow.spec)"
              @change="onRowHueInput(selectedRow, $event)"
            />
          </div>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex flex-col gap-1.5">
              <span class="text-base-content/70 text-sm font-semibold">Intensidad</span>
              <SegmentedControl
                :model-value="isNeutral(selectedRow.spec) ? 'media' : selectedRow.spec.intensity"
                :options="INTENSITIES"
                :disabled="isNeutral(selectedRow.spec)"
                label="Intensidad"
                @update:model-value="setIntensity(selectedRow, $event)"
              />
            </div>
            <label class="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                class="toggle toggle-sm"
                :checked="isNeutral(selectedRow.spec)"
                @change="setNeutral(selectedRow, ($event.target as HTMLInputElement).checked)"
              />
              Neutra (sin color)
            </label>
          </div>

          <div v-if="conflictFor(selectedRow)" class="alert alert-warning alert-soft text-sm">
            <IconWarning class="size-4" />
            <span>
              {{ labelFor(selectedRow) }} y {{ labelFor(conflictPartner(selectedRow)!) }} están a
              {{ conflictFor(selectedRow)!.distance }}° de tono: cuesta distinguirlos.
              <template v-if="suggestion !== null">
                <button class="link font-semibold" @click="setHue(selectedRow, suggestion)">
                  Probá {{ suggestion }}°
                </button>
                (el lugar libre más cercano) o separalas en intensidad: una suave y la otra intensa.
              </template>
              <template v-else>Separalas en intensidad: una suave y la otra intensa.</template>
            </span>
          </div>

          <ColorPreview :spec="selectedRow.spec" :collection-hue="mainHue" />
        </template>
      </div>
    </div>

    <!-- removed colors still in use -->
    <div
      v-for="r in removed"
      :key="r.originalKey"
      class="alert alert-warning alert-soft flex flex-wrap text-sm"
    >
      <IconWarning class="size-4" />
      <span class="flex-1">
        Quitaste <span class="font-mono">{{ r.originalKey }}</span>, que usan
        {{ usageLabel(usage[r.originalKey]) }}. ¿Con qué pista los reemplazamos?
      </span>
      <select v-model="r.replacement" class="select select-sm w-40 field-focus">
        <option v-for="row in rows" :key="row.uid" :value="row.key">{{ labelFor(row) }} ({{ row.key }})</option>
      </select>
    </div>

    <p v-if="error" class="text-error px-1 text-sm">{{ error }}</p>

    <SaveBar
      v-if="changeList.length"
      :label="saveLabel"
      :saving="saving"
      :disabled="blocked"
      save-label="Guardar pistas"
      @save="save"
      @discard="discard"
    />
  </SettingsSection>
</template>

<style scoped>
.neutral-swatch {
  background: repeating-linear-gradient(
    135deg,
    color-mix(in oklch, currentColor 35%, transparent) 0 5px,
    color-mix(in oklch, currentColor 10%, transparent) 5px 10px
  );
}
</style>
