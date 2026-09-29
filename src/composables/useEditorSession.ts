import {
  computed,
  type ComputedRef,
  inject,
  type InjectionKey,
  onBeforeUnmount,
  onMounted,
  provide,
  reactive,
  ref,
  type Ref
} from "vue";

import { useCollectionsStore } from "@/stores/collections";

export type EditorTabId = "cancion" | "letra" | "sincronizar";

export const EDITOR_TABS: { id: EditorTabId; label: string }[] = [
  { id: "cancion", label: "Canción" },
  { id: "letra", label: "Letra" },
  { id: "sincronizar", label: "Sincronizar" }
];

export const isEditorTabId = (value: unknown): value is EditorTabId =>
  value === "cancion" || value === "letra" || value === "sincronizar";

/**
 * What a tab (or any panel inside edit mode) contributes to the shared save bar.
 * Getters are read inside computeds, so reading refs in them keeps everything reactive.
 */
export type EditorTabHandle = {
  /** Whether this part has changes that "Guardar" would write. */
  isDirty: () => boolean;
  /** Writes the changes. Show your own error toast; resolve when done. */
  save: () => Promise<void>;
  /** Throws away the changes, back to the saved state. */
  discard: () => void | Promise<void>;
  /** Optional: blocks "Guardar" while false (e.g. invalid JSON). */
  canSave?: () => boolean;
  /** Optional: shows "Guardando…" while true. */
  isSaving?: () => boolean;
};

export type LeaveChoice = "save" | "discard" | "stay";

export type EditorSession = {
  /** Handles registered per tab id (a tab may register several parts). */
  dirtyByTab: ComputedRef<Record<EditorTabId, boolean>>;
  isDirty: ComputedRef<boolean>;
  isSaving: ComputedRef<boolean>;
  canSave: ComputedRef<boolean>;
  lastSavedAt: Ref<number | null>;
  /** The tab on screen. Tabs kept mounted in the background use it to hide their bar actions. */
  activeTab: Ref<EditorTabId>;
  /** "Editar como JSON (avanzado)" overlay, shown over the Letra tab. */
  jsonOpen: Ref<boolean>;
  register: (tab: EditorTabId, handle: EditorTabHandle) => () => void;
  save: () => Promise<boolean>;
  discard: () => Promise<void>;
  /** Asks what to do with unsaved changes. Resolves "discard" right away when clean. */
  confirmLeave: () => Promise<LeaveChoice>;
  /** The pending question for the unsaved-changes dialog (null when closed). */
  pendingLeave: Ref<((choice: LeaveChoice) => void) | null>;
};

const KEY: InjectionKey<EditorSession> = Symbol("editor-session");

/**
 * Creates the edit-mode session and provides it to every descendant.
 * Lyrics live in the collections store, so the session tracks them itself under "letra";
 * components with local state (the Canción form, Phase 5 panels) register with useEditorTab.
 */
export function provideEditorSession(): EditorSession {
  const store = useCollectionsStore();
  const handles = reactive(new Map<number, { tab: EditorTabId; handle: EditorTabHandle }>());
  let nextId = 0;

  const lyricsHandle: EditorTabHandle = {
    isDirty: () => store.localLyrics.isDirty,
    isSaving: () => store.localLyrics.isSaving,
    save: () => store.saveLyrics(),
    discard: () => store.discardLyricsChanges()
  };

  const all = computed(() => [
    { tab: "letra" as EditorTabId, handle: lyricsHandle },
    ...Array.from(handles.values())
  ]);

  const dirtyByTab = computed(() => {
    const result: Record<EditorTabId, boolean> = {
      cancion: false,
      letra: false,
      sincronizar: false
    };
    for (const { tab, handle } of all.value) {
      if (handle.isDirty()) result[tab] = true;
    }
    return result;
  });

  const isDirty = computed(() => all.value.some(({ handle }) => handle.isDirty()));
  const isSaving = computed(() => all.value.some(({ handle }) => handle.isSaving?.() ?? false));
  const canSave = computed(
    () =>
      isDirty.value &&
      !isSaving.value &&
      all.value.every(({ handle }) => handle.canSave?.() ?? true)
  );

  const lastSavedAt = ref<number | null>(null);
  const activeTab = ref<EditorTabId>("cancion");
  const jsonOpen = ref(false);
  const pendingLeave = ref<((choice: LeaveChoice) => void) | null>(null);

  const register = (tab: EditorTabId, handle: EditorTabHandle) => {
    const id = nextId++;
    handles.set(id, { tab, handle });
    return () => {
      handles.delete(id);
    };
  };

  // Lyrics (and Sincronizar, which edits the same lyrics) first: they are saved by song id
  // while the route still points at the song. The song form goes last because a slug
  // change navigates.
  const ORDER: EditorTabId[] = ["letra", "sincronizar", "cancion"];

  const save = async () => {
    if (!canSave.value) return !isDirty.value;
    const dirty = all.value
      .filter(({ handle }) => handle.isDirty())
      .sort((a, b) => ORDER.indexOf(a.tab) - ORDER.indexOf(b.tab));
    for (const { handle } of dirty) {
      try {
        await handle.save();
      } catch (error) {
        console.error("Error saving editor changes:", error);
      }
    }
    const saved = !isDirty.value;
    if (saved) lastSavedAt.value = Date.now();
    return saved;
  };

  const discard = async () => {
    for (const { handle } of all.value) {
      if (handle.isDirty()) await handle.discard();
    }
  };

  const confirmLeave = () =>
    new Promise<LeaveChoice>((resolve) => {
      if (!isDirty.value) {
        resolve("discard");
        return;
      }
      pendingLeave.value = (choice) => {
        pendingLeave.value = null;
        resolve(choice);
      };
    });

  const session: EditorSession = {
    dirtyByTab,
    isDirty,
    isSaving,
    canSave,
    lastSavedAt,
    activeTab,
    jsonOpen,
    register,
    save,
    discard,
    confirmLeave,
    pendingLeave
  };

  provide(KEY, session);
  return session;
}

export function useEditorSession(): EditorSession {
  const session = inject(KEY, null);
  if (!session) throw new Error("useEditorSession() needs provideEditorSession() in an ancestor");
  return session;
}

/** Registers a tab's local changes with the save bar while the component is mounted. */
export function useEditorTab(tab: EditorTabId, handle: EditorTabHandle) {
  const session = useEditorSession();
  let unregister: (() => void) | null = null;
  onMounted(() => {
    unregister = session.register(tab, handle);
  });
  onBeforeUnmount(() => unregister?.());
  return session;
}

/** "Guardado hace un momento" / "Guardado a las 21:04". */
export function savedLabel(savedAt: number | null, now: number): string | null {
  if (savedAt === null) return null;
  if (now - savedAt < 60_000) return "Guardado hace un momento";
  const date = new Date(savedAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `Guardado a las ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
