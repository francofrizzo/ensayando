<script setup lang="ts">
import { computed, ref, watch } from "vue";

import { IconClose, IconCopy, IconGoTo, IconMarkTime, IconTrash } from "@/components/ui/icons";
import type { CommandRegistry } from "@/composables/useCommands";
import type { AudioTrack, LyricStanza } from "@/data/types";
import { prettyKeyParts } from "@/utils/keys";
import {
  formatVerseTime,
  getVerseAt,
  nudgeTime,
  parseVerseTime,
  type Presence,
  summarizeSelection
} from "@/utils/lyricsSelection";
import type { FocusPosition } from "@/utils/lyricsPositionUtils";

type ColorOption = { key: string; ink: string };

const props = defineProps<{
  lyrics: LyricStanza[];
  selection: FocusPosition[];
  colors: ColorOption[];
  tracks: AudioTrack[];
  trackInk: (colorKey: string) => string;
  commandRegistry: CommandRegistry;
  /** The verse "Copiar de este verso" copies from (the focused one). */
  anchor?: FocusPosition | null;
  /** Phone: shown as a bottom sheet with a close button. */
  sheet?: boolean;
}>();

const emit = defineEmits<{
  "toggle-color": [key: string];
  "toggle-track": [id: number];
  "set-comment": [comment: string | undefined];
  "set-time": [which: "start" | "end", value: number | undefined];
  "copy-from-anchor": [];
  close: [];
}>();

const anchorText = computed(() => {
  if (props.selection.length < 2 || !props.anchor) return null;
  return getVerseAt(props.lyrics, props.anchor)?.text.trim() || "(sin texto)";
});

const single = computed(() => (props.selection.length === 1 ? props.selection[0]! : null));
const verse = computed(() => (single.value ? getVerseAt(props.lyrics, single.value) : null));

const summary = computed(() =>
  summarizeSelection(
    props.lyrics,
    props.selection,
    props.colors.map((c) => c.key),
    props.tracks.map((t) => t.id)
  )
);

/** "Estrofa 2 · verso 1 · “Vidala, vidala”". */
const where = computed(() => {
  const position = single.value;
  if (!position) return "";
  const stanza = props.lyrics[position.stanzaIndex] ?? [];
  let number = 0;
  for (let i = 0; i < position.itemIndex; i++) {
    const item = stanza[i];
    number += Array.isArray(item) ? Math.max(...item.map((c) => c.length), 1) : 1;
  }
  number += (position.lineIndex ?? 0) + 1;
  const column = position.columnIndex !== undefined ? ` · columna ${position.columnIndex + 1}` : "";
  const text = verse.value?.text.trim();
  return `Estrofa ${position.stanzaIndex + 1} · verso ${number}${column}${text ? ` · “${text}”` : ""}`;
});

const colorOrder = (key: string) => {
  const keys = verse.value?.color_keys ?? [];
  return keys.length > 1 ? keys.indexOf(key) + 1 : 0;
};

const chipClass = (state: Presence | undefined) => {
  if (state === "all") return "ring-2 ring-current bg-base-content/6";
  // Only some of the selected verses have it: dashed, like the deck's "rayas"
  if (state === "some") return "outline-1 outline-dashed outline-current bg-base-content/3";
  return "ring-1 ring-base-content/15 opacity-75 hover:opacity-100";
};

// Comment: typed text is kept locally so an empty field doesn't remove the comment mid-edit.
const commentDraft = ref("");
watch(
  () => [summary.value.comment.value, summary.value.comment.mixed, props.selection] as const,
  ([value]) => {
    commentDraft.value = value ?? "";
  },
  { immediate: true }
);
const onCommentInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  commentDraft.value = value;
  emit("set-comment", value.trim() === "" ? undefined : value);
};

// Times (one verse at a time)
const timeDrafts = ref({ start: "", end: "" });
watch(
  () => [verse.value?.start_time, verse.value?.end_time] as const,
  ([start, end]) => {
    timeDrafts.value = { start: formatVerseTime(start) ?? "", end: formatVerseTime(end) ?? "" };
  },
  { immediate: true }
);
const timeOf = (which: "start" | "end") =>
  which === "start" ? verse.value?.start_time : verse.value?.end_time;
const commitTime = (which: "start" | "end") => {
  const parsed = parseVerseTime(timeDrafts.value[which]);
  if (parsed === null) {
    timeDrafts.value[which] = formatVerseTime(timeOf(which)) ?? "";
    return;
  }
  if (parsed !== timeOf(which)) emit("set-time", which, parsed);
};
const nudge = (which: "start" | "end", step: number) => {
  emit("set-time", which, nudgeTime(timeOf(which), step));
};

const keysFor = (commandId: string) => {
  const command = props.commandRegistry.getCommand(commandId);
  return command ? prettyKeyParts(props.commandRegistry.getKeybindingParts(command)) : [];
};
const run = (commandId: string) => props.commandRegistry.execute(commandId);
</script>

<template>
  <aside
    class="flex min-h-0 flex-col"
    :class="sheet ? '' : 'h-full'"
    data-testid="lyrics-inspector"
    aria-label="Propiedades del verso"
  >
    <div class="flex items-start gap-3 px-4 pt-4 pb-3">
      <div class="min-w-0 flex-1">
        <h3 class="font-display text-[17px] leading-tight font-bold">
          {{ selection.length > 1 ? `${selection.length} versos seleccionados` : "Verso" }}
        </h3>
        <p
          v-if="selection.length > 1"
          class="text-base-content/55 mt-1 text-[12.5px]"
          data-testid="inspector-count"
        >
          Los cambios se aplican a todos. ⇧+clic amplía, ⌘+clic suma o quita.
        </p>
        <button
          v-if="anchorText"
          class="btn btn-soft btn-xs mt-2 max-w-full justify-start rounded-full"
          data-testid="inspector-copy-from-anchor"
          :title="`Todos quedan con los colores y pistas de “${anchorText}”`"
          @click="emit('copy-from-anchor')"
        >
          <IconCopy class="size-3.5 shrink-0" />
          <span class="truncate">Copiar colores y pistas de “{{ anchorText }}”</span>
        </button>
        <p v-else-if="single" class="text-base-content/55 mt-1 truncate text-[12.5px]">
          {{ where }}
        </p>
      </div>
      <button
        v-if="sheet"
        class="btn btn-ghost btn-sm btn-square rounded-full"
        aria-label="Cerrar"
        @click="emit('close')"
      >
        <IconClose class="size-4" />
      </button>
    </div>

    <div
      v-if="selection.length === 0"
      class="text-base-content/50 flex flex-1 items-center justify-center px-6 pb-8 text-center text-sm"
    >
      Elegí un verso para ver sus colores, pistas y tiempos.
    </div>

    <div v-else class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">
      <!-- Colores -->
      <section class="flex flex-col gap-2">
        <div class="flex items-baseline justify-between gap-2">
          <h4 class="text-[12.5px] font-semibold">Colores</h4>
          <span class="text-base-content/45 text-[11.5px]">el degradé sigue este orden</span>
        </div>
        <div v-if="colors.length" class="flex flex-wrap gap-1.5">
          <button
            v-for="color in colors"
            :key="color.key"
            class="relative inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 font-mono text-[12px] font-semibold transition"
            :class="chipClass(summary.colors[color.key])"
            :style="{ color: color.ink }"
            :aria-pressed="summary.colors[color.key] === 'all'"
            :data-testid="`inspector-color-${color.key}`"
            @click="emit('toggle-color', color.key)"
          >
            <span class="size-2.5 rounded-full" :style="{ background: color.ink }" />
            <span>{{ color.key }}</span>
            <span
              v-if="colorOrder(color.key)"
              class="bg-base-content text-base-100 -mr-1 grid size-4 place-items-center rounded-full text-[10px]"
              >{{ colorOrder(color.key) }}</span
            >
          </button>
        </div>
        <p v-else class="text-base-content/50 text-[12.5px]">
          La colección no tiene colores de pista.
        </p>
      </section>

      <!-- Pistas -->
      <section class="flex flex-col gap-2">
        <div class="flex items-baseline justify-between gap-2">
          <h4 class="text-[12.5px] font-semibold">Pistas</h4>
          <span class="text-base-content/45 text-[11.5px]">su letra se oculta con la pista</span>
        </div>
        <div v-if="tracks.length" class="flex flex-col">
          <label
            v-for="track in tracks"
            :key="track.id"
            class="hover:bg-base-content/5 -mx-2 flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm"
          >
            <input
              type="checkbox"
              class="checkbox checkbox-xs"
              :checked="summary.tracks[track.id] === 'all'"
              :indeterminate="summary.tracks[track.id] === 'some'"
              :data-testid="`inspector-track-${track.id}`"
              @change="emit('toggle-track', track.id)"
            />
            <span
              class="size-2.5 rounded-full"
              :style="{ background: trackInk(track.color_key) }"
            />
            <span class="min-w-0 flex-1 truncate font-medium">{{ track.title }}</span>
            <span class="text-base-content/35 font-mono text-[11px]">#{{ track.id }}</span>
          </label>
        </div>
        <p v-else class="text-base-content/50 text-[12.5px]">La canción no tiene pistas.</p>
      </section>

      <!-- Comentario -->
      <section class="flex flex-col gap-2">
        <h4 class="text-[12.5px] font-semibold">Comentario</h4>
        <input
          type="text"
          class="input input-sm w-full rounded-[10px]"
          :value="commentDraft"
          :placeholder="summary.comment.mixed ? 'Varios comentarios distintos' : 'Coro, Solo soprano…'"
          data-testid="inspector-comment"
          @keydown.stop
          @input="onCommentInput"
        />
      </section>

      <!-- Tiempos -->
      <section class="flex flex-col gap-2">
        <h4 class="text-[12.5px] font-semibold">Tiempos</h4>
        <template v-if="single && verse">
          <div class="grid grid-cols-2 gap-2">
            <div v-for="which in ['start', 'end'] as const" :key="which" class="flex flex-col gap-1">
              <span class="text-base-content/55 text-[11.5px]">
                {{ which === "start" ? "Inicio" : "Fin" }}
              </span>
              <div class="join w-full">
                <button
                  class="btn btn-sm join-item px-2 font-mono"
                  :aria-label="`${which === 'start' ? 'Inicio' : 'Fin'} −0,1 s`"
                  @click="nudge(which, -0.1)"
                >
                  −
                </button>
                <input
                  v-model="timeDrafts[which]"
                  class="input input-sm join-item w-full min-w-0 text-center font-mono tabular-nums"
                  placeholder="sin tiempo"
                  :data-testid="`inspector-${which}`"
                  @keydown.stop
                  @blur="commitTime(which)"
                  @keydown.enter.prevent="commitTime(which)"
                />
                <button
                  class="btn btn-sm join-item px-2 font-mono"
                  :aria-label="`${which === 'start' ? 'Inicio' : 'Fin'} +0,1 s`"
                  @click="nudge(which, 0.1)"
                >
                  +
                </button>
              </div>
            </div>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button class="btn btn-soft btn-xs gap-1.5 rounded-full" @click="run('set-start-time')">
              <IconMarkTime class="size-3.5" />
              Usar tiempo actual
              <kbd v-for="k in keysFor('set-start-time')" :key="k" class="kbd kbd-xs">{{ k }}</kbd>
            </button>
            <button class="btn btn-soft btn-xs gap-1.5 rounded-full" @click="run('set-end-time')">
              Como fin
              <kbd v-for="k in keysFor('set-end-time')" :key="k" class="kbd kbd-xs">{{ k }}</kbd>
            </button>
            <button
              class="btn btn-soft btn-xs gap-1.5 rounded-full"
              :disabled="verse.start_time === undefined"
              @click="run('seek-to-verse')"
            >
              <IconGoTo class="size-3.5" />
              Ir al verso
              <kbd v-for="k in keysFor('seek-to-verse')" :key="k" class="kbd kbd-xs">{{ k }}</kbd>
            </button>
          </div>
        </template>
        <p v-else class="text-base-content/50 text-[12.5px]">
          Los tiempos se editan de a un verso, acá o en Sincronizar.
        </p>
      </section>
    </div>

    <div
      v-if="single"
      class="border-base-content/8 flex items-center justify-between gap-2 border-t px-3 py-2.5"
    >
      <button class="btn btn-ghost btn-sm gap-1.5 rounded-full" @click="run('duplicate-line')">
        <IconCopy class="size-4" />
        Duplicar
      </button>
      <button
        class="btn btn-ghost btn-sm text-error gap-1.5 rounded-full"
        data-testid="inspector-delete"
        @click="run('delete-line')"
      >
        <IconTrash class="size-4" />
        Eliminar verso
      </button>
    </div>
  </aside>
</template>
