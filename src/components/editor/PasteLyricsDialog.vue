<script setup lang="ts">
import { computed, ref, watch } from "vue";

import { IconPasteText } from "@/components/ui/icons";
import { useDialogFocus } from "@/composables/useDialogFocus";
import { textToLyrics } from "@/utils/lyricsText";
import { useCollectionsStore } from "@/stores/collections";

const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ applied: [] }>();

const store = useCollectionsStore();
const text = ref("");
const mode = ref<"replace" | "append">("replace");
const hasLyrics = computed(() => store.localLyrics.value.length > 0);
const parsed = computed(() => textToLyrics(text.value));
const verseCount = computed(() =>
  parsed.value.reduce((total, stanza) => total + stanza.length, 0)
);

watch(open, (isOpen) => {
  if (isOpen) {
    text.value = "";
    mode.value = hasLyrics.value ? "append" : "replace";
  }
});

const dialog = ref<HTMLElement | null>(null);
const textarea = ref<HTMLTextAreaElement | null>(null);
useDialogFocus({ open, container: dialog, initial: textarea, onClose: () => (open.value = false) });

// One undo step: the whole paste is a single update of the lyrics.
const apply = () => {
  if (parsed.value.length === 0) return;
  const next =
    mode.value === "append" && hasLyrics.value
      ? [...JSON.parse(JSON.stringify(store.localLyrics.value)), ...parsed.value]
      : parsed.value;
  void store.updateLocalLyrics(next);
  open.value = false;
  emit("applied");
};
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[70] flex items-end justify-center bg-black/30 p-3 backdrop-blur-[3px] sm:items-center"
      @click.self="open = false"
    >
      <div
        ref="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="paste-lyrics-title"
        class="glass-3 rounded-box flex w-full max-w-lg flex-col gap-4 p-5"
        data-testid="paste-lyrics-dialog"
      >
        <div class="flex items-start gap-3">
          <span
            class="bg-collection-soft text-collection-ink grid size-9 shrink-0 place-items-center rounded-full"
          >
            <IconPasteText class="size-5" />
          </span>
          <div class="flex flex-col gap-1">
            <h2 id="paste-lyrics-title" class="font-display text-lg font-bold">
              Pegar letra desde texto
            </h2>
            <p class="text-base-content/70 text-sm">
              Una línea por verso y una línea en blanco entre estrofas. Una línea entre corchetes,
              como <span class="font-mono text-xs">[Coro]</span>, es el comentario del verso de abajo;
              <span class="font-mono text-xs"> / </span> separa columnas.
            </p>
          </div>
        </div>

        <textarea
          ref="textarea"
          v-model="text"
          rows="10"
          class="textarea bg-base-100 w-full font-mono text-[13px] leading-relaxed field-focus"
          placeholder="Sopla el viento por la loma&#10;y se lleva mi canción&#10;&#10;[Coro]&#10;Vidala, vidala"
          data-testid="paste-lyrics-text"
        />

        <div v-if="hasLyrics" class="flex flex-wrap gap-2" role="radiogroup" aria-label="Qué hacer con la letra actual">
          <label class="flex cursor-pointer items-center gap-2 text-sm">
            <input v-model="mode" type="radio" value="append" class="radio radio-sm radio-primary" />
            Agregar al final
          </label>
          <label class="flex cursor-pointer items-center gap-2 text-sm">
            <input v-model="mode" type="radio" value="replace" class="radio radio-sm radio-primary" />
            Reemplazar la letra actual
          </label>
        </div>

        <div class="flex flex-wrap items-center justify-end gap-2">
          <span class="text-base-content/60 mr-auto text-xs">
            <template v-if="parsed.length">
              {{ parsed.length }} {{ parsed.length === 1 ? "estrofa" : "estrofas" }},
              {{ verseCount }} {{ verseCount === 1 ? "verso" : "versos" }}
            </template>
          </span>
          <button class="btn btn-sm btn-ghost rounded-full font-semibold" @click="open = false">
            Cancelar
          </button>
          <button
            class="btn btn-sm btn-primary rounded-full font-semibold"
            :disabled="parsed.length === 0"
            data-testid="paste-lyrics-apply"
            @click="apply"
          >
            {{ mode === "replace" || !hasLyrics ? "Usar esta letra" : "Agregar" }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
