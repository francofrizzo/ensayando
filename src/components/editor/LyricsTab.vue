<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";

import LyricsInspector from "@/components/editor/LyricsInspector.vue";
import LyricsToolbar from "@/components/editor/LyricsToolbar.vue";
import LyricsVerseRow from "@/components/editor/LyricsVerseRow.vue";
import { IconMixer } from "@/components/ui/icons";
import { useCollectionPalette } from "@/composables/useCollectionPalette";
import { useCurrentCollection } from "@/composables/useCurrentCollection";
import { usePlayerState } from "@/composables/useCurrentTime";
import { useEditorSession } from "@/composables/useEditorSession";
import { useLyricsColoring } from "@/composables/useLyricsColoring";
import { useLyricsEditor, type FocusPosition } from "@/composables/useLyricsEditor";
import { useReactionOffset } from "@/composables/useReactionOffset";
import type { LyricStanza, LyricVerse } from "@/data/types";
import { useCollectionsStore } from "@/stores/collections";
import { useUIStore } from "@/stores/ui";
import { isTypingTarget } from "@/utils/keys";
import {
  activeVerseKeys,
  copyColorsAndTracks,
  createEmptyLyrics,
  adjacentPosition,
  getVerseAt,
  moveItemTo,
  positionKey,
  pruneSelection,
  selectRange,
  setCommentInVerses,
  toggleColorInVerses,
  togglePosition,
  toggleTrackInVerses,
  updateVerses
} from "@/utils/lyricsSelection";
import { addStatusToLyrics } from "@/utils/lyricsViewerUtils";

import KeyboardHelpModal from "./KeyboardHelpModal.vue";

const store = useCollectionsStore();
const uiStore = useUIStore();
const { currentCollection } = useCurrentCollection();
const { currentTime, isPlaying, seekTo } = usePlayerState();
const { getVerseStyles } = useLyricsColoring();
const { palette, trackColor } = useCollectionPalette(currentCollection);
const reaction = useReactionOffset();
const session = useEditorSession();

// ⌘S goes through the edit bar, which saves every tab.
const handleSave = () => {
  void session.save();
};

// A fresh empty verse each time the lyrics become empty (the editor writes into it).
const lyricsToDisplay = computed<LyricStanza[]>(() =>
  store.localLyrics.value.length === 0 ? createEmptyLyrics() : store.localLyrics.value
);

const {
  currentFocus,
  updateLyrics,
  showHelp,
  handleInputFocus,
  focusInput,
  commandRegistry
} = useLyricsEditor(
  lyricsToDisplay,
  store.updateLocalLyrics,
  handleSave,
  // Every mark subtracts the reaction-time correction (remembered on this device).
  () => reaction.apply(currentTime.value),
  seekTo,
  store.undo,
  store.redo
);

// ---------- view toggles (remembered on this device) ----------
const readFlag = (key: string, fallback: boolean) => {
  try {
    const stored = window.localStorage.getItem(key);
    return stored === null ? fallback : stored === "1";
  } catch {
    return fallback;
  }
};
const writeFlag = (key: string, value: boolean) => {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Storage can be unavailable (private mode); the toggle lasts for the session.
  }
};
const showTimestamps = ref(readFlag("ens-lyrics-times", true));
const followPlayback = ref(readFlag("ens-lyrics-follow", true));
watch(showTimestamps, (value) => writeFlag("ens-lyrics-times", value));
watch(followPlayback, (value) => writeFlag("ens-lyrics-follow", value));

// ---------- selection ----------
// The focused verse is always selected; ⇧+clic / ⇧↑↓ extend from the anchor, ⌘+clic toggles.
const selection = ref<FocusPosition[]>([]);
const anchor = ref<FocusPosition | null>(null);
let pendingGesture: "extend" | "toggle" | null = null;

const selectedKeys = computed(
  () => new Set(pruneSelection(lyricsToDisplay.value, selection.value).map(positionKey))
);
const effectiveSelection = computed(() => {
  const pruned = pruneSelection(lyricsToDisplay.value, selection.value);
  if (pruned.length > 0) return pruned;
  return currentFocus.value ? [currentFocus.value] : [];
});

const onRowMouseDown = (event: MouseEvent, position: FocusPosition) => {
  pendingGesture = event.shiftKey ? "extend" : event.metaKey || event.ctrlKey ? "toggle" : null;
  if (!pendingGesture) return;
  // With a modifier the browser would extend the text selection of the focused verse
  // instead of moving to the clicked one, so we move focus ourselves.
  event.preventDefault();
  const input = document.querySelector(`[data-lyrics-input="${positionKey(position)}"]`);
  if (input && input === document.activeElement) onVerseFocus(position);
  else void focusInput(position);
};

const onVerseFocus = (position: FocusPosition) => {
  handleInputFocus(position);
  const gesture = pendingGesture;
  pendingGesture = null;
  if (gesture === "extend") {
    selection.value = selectRange(lyricsToDisplay.value, anchor.value ?? position, position);
  } else if (gesture === "toggle") {
    const base = selection.value.length > 0 ? selection.value : [];
    const next = togglePosition(base, position);
    selection.value = next.length > 0 ? next : [position];
    anchor.value = position;
  } else {
    selection.value = [position];
    anchor.value = position;
  }
};

// Structure changes (insert, delete, move) can leave positions pointing elsewhere.
watch(
  () => store.localLyrics.value,
  () => {
    selection.value = pruneSelection(lyricsToDisplay.value, selection.value);
  }
);

const collapseSelection = () => {
  if (currentFocus.value) {
    selection.value = [currentFocus.value];
    anchor.value = currentFocus.value;
  }
};

// ---------- inspector actions (each is one undo step) ----------
const apply = (next: LyricStanza[]) => updateLyrics(next);

const colorOptions = computed(() =>
  Object.keys(palette.value.tracks).map((key) => ({ key, ink: trackColor(key, "lyric") }))
);
const trackInk = (colorKey: string) => trackColor(colorKey, "lyric");

const availableAudioTracks = computed(() => {
  const song = store.currentSong;
  if (!song) return [];
  return [...song.audio_tracks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
});

const onToggleColor = (key: string) =>
  apply(toggleColorInVerses(lyricsToDisplay.value, effectiveSelection.value, key));
const onToggleTrack = (id: number) =>
  apply(toggleTrackInVerses(lyricsToDisplay.value, effectiveSelection.value, id));
const onSetComment = (comment: string | undefined) =>
  apply(setCommentInVerses(lyricsToDisplay.value, effectiveSelection.value, comment));
// "Copiar de este verso": the focused verse is the source.
const copyAnchor = computed(() => {
  const focus = currentFocus.value;
  const selected = effectiveSelection.value;
  if (focus && selected.some((p) => positionKey(p) === positionKey(focus))) return focus;
  return selected[0] ?? null;
});
const onCopyFromAnchor = () => {
  if (!copyAnchor.value) return;
  apply(copyColorsAndTracks(lyricsToDisplay.value, copyAnchor.value, effectiveSelection.value));
};
const onSetTime = (which: "start" | "end", value: number | undefined) =>
  apply(
    updateVerses(lyricsToDisplay.value, effectiveSelection.value.slice(0, 1), (verse) => {
      if (which === "start") verse.start_time = value;
      else verse.end_time = value;
    })
  );

// ---------- text ----------
const setVerseText = (position: FocusPosition, text: string) => {
  const lyrics = [...lyricsToDisplay.value];
  const verse = getVerseAt(lyrics, position);
  if (!verse) return;
  verse.text = text;
  updateLyrics(lyrics);
};

const verseDots = (verse: LyricVerse) => (verse.color_keys ?? []).map((key) => trackInk(key));

// ---------- playback ----------
const soundingKeys = computed(() =>
  activeVerseKeys(addStatusToLyrics(lyricsToDisplay.value, currentTime.value))
);
const firstSounding = computed(() => [...soundingKeys.value][0] ?? null);
const sheetRef = ref<HTMLElement | null>(null);
watch(firstSounding, async (key) => {
  if (!key || !followPlayback.value || !isPlaying.value) return;
  // Don't pull the page away from someone who is typing a verse.
  if (isTypingTarget(document.activeElement)) return;
  await nextTick();
  sheetRef.value
    ?.querySelector(`[data-verse-key="${key}"]`)
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
});

// ---------- drag and drop (whole items) ----------
const dragFrom = ref<{ stanzaIndex: number; itemIndex: number } | null>(null);
const dropTarget = ref<{ stanzaIndex: number; itemIndex: number } | null>(null);

const onDragStart = (event: DragEvent, stanzaIndex: number, itemIndex: number) => {
  dragFrom.value = { stanzaIndex, itemIndex };
  event.dataTransfer?.setData("text/plain", `${stanzaIndex}-${itemIndex}`);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
};
const onDragOver = (event: DragEvent, stanzaIndex: number, itemIndex: number) => {
  if (!dragFrom.value) return;
  event.preventDefault();
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const after = event.clientY > rect.top + rect.height / 2;
  dropTarget.value = { stanzaIndex, itemIndex: after ? itemIndex + 1 : itemIndex };
};
const onDrop = () => {
  if (dragFrom.value && dropTarget.value) {
    const result = moveItemTo(lyricsToDisplay.value, dragFrom.value, dropTarget.value);
    if (result) {
      apply(result.lyrics);
      void focusInput(result.position);
    }
  }
  onDragEnd();
};
const onDragEnd = () => {
  dragFrom.value = null;
  dropTarget.value = null;
};
const isDropBefore = (stanzaIndex: number, itemIndex: number) =>
  dropTarget.value?.stanzaIndex === stanzaIndex && dropTarget.value.itemIndex === itemIndex;

// ---------- keyboard: selection, preview, help ----------
const togglePreview = () => uiStore.setEditorPreview(!uiStore.editorPreview);

const handleKeydown = (event: KeyboardEvent) => {
  const typing = isTypingTarget(event.target);
  const onVerse = (event.target as HTMLElement | null)?.hasAttribute?.("data-lyrics-input");
  const plain = !event.metaKey && !event.ctrlKey && !event.altKey;

  if (
    plain &&
    event.shiftKey &&
    (event.key === "ArrowUp" || event.key === "ArrowDown") &&
    currentFocus.value &&
    (!typing || onVerse)
  ) {
    const next = adjacentPosition(
      lyricsToDisplay.value,
      currentFocus.value,
      event.key === "ArrowUp" ? "up" : "down"
    );
    event.preventDefault();
    if (!next) return;
    pendingGesture = "extend";
    if (!anchor.value) anchor.value = currentFocus.value;
    void focusInput(next);
    return;
  }

  if (typing) return;
  if (plain && event.key === "?") {
    event.preventDefault();
    showHelp.value = !showHelp.value;
  } else if (plain && !event.shiftKey && event.key.toLowerCase() === "p") {
    event.preventDefault();
    togglePreview();
  } else if (event.key === "Escape" && selection.value.length > 1) {
    collapseSelection();
  }
};

onMounted(() => document.addEventListener("keydown", handleKeydown));
onUnmounted(() => {
  document.removeEventListener("keydown", handleKeydown);
  uiStore.setEditorPreview(false);
});

// ---------- phone: the inspector is a bottom sheet ----------
const inspectorSheetOpen = ref(false);
watch(currentFocus, (focus) => {
  if (!focus) inspectorSheetOpen.value = false;
});

const verseKey = (stanzaIndex: number, itemIndex: number, columnIndex?: number, lineIndex?: number) =>
  positionKey({ stanzaIndex, itemIndex, columnIndex, lineIndex });
const isFocused = (key: string) => !!currentFocus.value && positionKey(currentFocus.value) === key;

defineExpose({
  hasUnsavedChanges: computed(() => store.localLyrics.isDirty)
});
</script>

<template>
  <div class="relative flex h-full min-h-0" data-testid="lyrics-tab">
    <div class="flex min-w-0 flex-1 flex-col">
      <LyricsToolbar
        :command-registry="commandRegistry"
        :current-focus="currentFocus"
        :can-undo="store.canUndo"
        :can-redo="store.canRedo"
        :show-timestamps="showTimestamps"
        :follow-playback="followPlayback"
        @toggle-timestamps="showTimestamps = !showTimestamps"
        @toggle-follow="followPlayback = !followPlayback"
        @preview="togglePreview"
        @help="showHelp = !showHelp"
      />

      <div
        ref="sheetRef"
        class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 py-3 md:px-4"
        data-testid="lyrics-sheet"
        @dragover.prevent
        @drop.prevent="onDrop"
      >
        <section
          v-for="(stanza, i) in lyricsToDisplay"
          :key="i"
          class="border-base-content/10 flex flex-col gap-0.5 border-dashed pb-3 not-first:mt-2 not-first:border-t not-first:pt-3"
          :data-stanza="i"
        >
          <h4
            class="text-base-content/40 pb-1 pl-11 text-[10.5px] font-semibold tracking-[0.12em] uppercase"
          >
            Estrofa {{ i + 1 }}
          </h4>

          <template v-for="(item, j) in stanza" :key="`${i}-${j}`">
            <LyricsVerseRow
              v-if="!Array.isArray(item)"
              :verse="item"
              :input-key="verseKey(i, j)"
              :selected="selectedKeys.has(verseKey(i, j)) && selectedKeys.size > 1"
              :focused="isFocused(verseKey(i, j))"
              :sounding="soundingKeys.has(verseKey(i, j))"
              :show-times="showTimestamps"
              :verse-styles="getVerseStyles(item, currentCollection)"
              :dots="verseDots(item)"
              :draggable="true"
              :drop-before="isDropBefore(i, j)"
              :placeholder="i === 0 && j === 0 ? 'Escribí el primer verso' : ''"
              @select="(event: MouseEvent) => onRowMouseDown(event, { stanzaIndex: i, itemIndex: j })"
              @focus="onVerseFocus({ stanzaIndex: i, itemIndex: j })"
              @update:text="(text) => setVerseText({ stanzaIndex: i, itemIndex: j }, text)"
              @dragstart="(event) => onDragStart(event, i, j)"
              @dragend="onDragEnd"
              @dragover="(event: DragEvent) => onDragOver(event, i, j)"
            />

            <!-- Columns: side by side with a dashed divider; the row moves as a whole -->
            <div
              v-else
              class="relative flex w-full items-stretch"
              @dragover="(event: DragEvent) => onDragOver(event, i, j)"
            >
              <span
                v-if="isDropBefore(i, j)"
                class="bg-primary pointer-events-none absolute inset-x-2 -top-px h-0.5 rounded-full"
              />
              <div
                v-for="(column, k) in item"
                :key="`${i}-${j}-${k}`"
                class="border-base-content/15 flex min-w-0 flex-1 flex-col justify-center border-dashed not-last:border-r"
              >
                <LyricsVerseRow
                  v-for="(line, l) in column"
                  :key="`${i}-${j}-${k}-${l}`"
                  :verse="line"
                  :input-key="verseKey(i, j, k, l)"
                  :selected="selectedKeys.has(verseKey(i, j, k, l)) && selectedKeys.size > 1"
                  :focused="isFocused(verseKey(i, j, k, l))"
                  :sounding="soundingKeys.has(verseKey(i, j, k, l))"
                  :show-times="showTimestamps"
                  :verse-styles="getVerseStyles(line, currentCollection)"
                  :dots="verseDots(line)"
                  :draggable="k === 0 && l === 0"
                  @select="
                    (event: MouseEvent) =>
                      onRowMouseDown(event, {
                        stanzaIndex: i,
                        itemIndex: j,
                        columnIndex: k,
                        lineIndex: l
                      })
                  "
                  @focus="
                    onVerseFocus({ stanzaIndex: i, itemIndex: j, columnIndex: k, lineIndex: l })
                  "
                  @update:text="
                    (text) =>
                      setVerseText(
                        { stanzaIndex: i, itemIndex: j, columnIndex: k, lineIndex: l },
                        text
                      )
                  "
                  @dragstart="(event) => onDragStart(event, i, j)"
                  @dragend="onDragEnd"
                />
              </div>
            </div>
          </template>

          <div
            class="h-2"
            @dragover="(event: DragEvent) => onDragOver(event, i, stanza.length - 1)"
          />
        </section>
      </div>

      <!-- Phone / tablet: open the inspector as a sheet -->
      <div
        v-if="currentFocus && !inspectorSheetOpen"
        class="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center lg:hidden"
      >
        <button
          class="btn btn-sm glass-3 pointer-events-auto gap-2 rounded-full border-0 font-semibold"
          data-testid="open-inspector"
          @mousedown.prevent
          @click="inspectorSheetOpen = true"
        >
          <IconMixer class="size-4" />
          {{
            effectiveSelection.length > 1
              ? `${effectiveSelection.length} versos`
              : "Propiedades del verso"
          }}
        </button>
      </div>
    </div>

    <!-- Desktop: the inspector is always there -->
    <LyricsInspector
      class="border-base-content/8 hidden w-[300px] shrink-0 border-l lg:flex"
      :lyrics="lyricsToDisplay"
      :selection="effectiveSelection"
      :colors="colorOptions"
      :tracks="availableAudioTracks"
      :track-ink="trackInk"
      :command-registry="commandRegistry"
      :anchor="copyAnchor"
      @toggle-color="onToggleColor"
      @toggle-track="onToggleTrack"
      @set-comment="onSetComment"
      @set-time="onSetTime"
      @copy-from-anchor="onCopyFromAnchor"
    />

    <Transition name="sheet">
      <div
        v-if="inspectorSheetOpen && currentFocus"
        class="bg-base-100 rounded-t-box ring-base-content/10 absolute inset-x-0 bottom-0 z-20 flex max-h-[92%] flex-col shadow-2xl ring-1 lg:hidden"
      >
        <div class="bg-base-content/20 mx-auto mt-2 h-[5px] w-[38px] shrink-0 rounded-full" />
        <LyricsInspector
          sheet
          class="min-h-0 flex-1"
          :lyrics="lyricsToDisplay"
          :selection="effectiveSelection"
          :colors="colorOptions"
          :tracks="availableAudioTracks"
          :track-ink="trackInk"
          :command-registry="commandRegistry"
          :anchor="copyAnchor"
          @toggle-color="onToggleColor"
          @toggle-track="onToggleTrack"
          @set-comment="onSetComment"
          @set-time="onSetTime"
          @copy-from-anchor="onCopyFromAnchor"
          @close="inspectorSheetOpen = false"
        />
      </div>
    </Transition>

    <KeyboardHelpModal
      :show="showHelp"
      :command-registry="commandRegistry"
      @close="showHelp = false"
    />
  </div>
</template>

<style scoped>
.sheet-enter-active,
.sheet-leave-active {
  transition:
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 220ms ease;
}
.sheet-enter-from,
.sheet-leave-to {
  transform: translateY(24px);
  opacity: 0;
}
</style>
