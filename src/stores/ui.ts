import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";

import { type EditorTabId, isEditorTabId } from "@/composables/useEditorSession";
import router from "@/router";
import { useCollectionsStore } from "@/stores/collections";

export const useUIStore = defineStore("ui", () => {
  const collectionsStore = useCollectionsStore();

  // Edit mode lives in the URL (?editar=cancion|letra|sincronizar) so it survives a reload
  // and the browser's back button leaves it. Only editors of the collection get it.
  const editTab = computed<EditorTabId | null>(() => {
    const route = router.currentRoute.value;
    if (route.name !== "song") return null;
    const value = route.query.editar;
    return isEditorTabId(value) ? value : null;
  });
  const editMode = computed(
    () => editTab.value !== null && collectionsStore.canEditCurrentCollection
  );

  const openEditor = (tab: EditorTabId = "cancion") => {
    const route = router.currentRoute.value;
    if (route.name !== "song") return;
    void router.push({ query: { ...route.query, editar: tab } });
  };

  const setEditorTab = (tab: EditorTabId) => {
    const route = router.currentRoute.value;
    if (route.name !== "song") return;
    void router.replace({ query: { ...route.query, editar: tab } });
  };

  const closeEditor = () => {
    const route = router.currentRoute.value;
    if (!("editar" in route.query)) return;
    const query = { ...route.query };
    delete query.editar;
    void router.push({ query });
  };

  // "Vista previa" in the Letra tab: the stage comes back (with unsaved lyrics) without
  // leaving edit mode. Any change of tab or leaving edit mode turns it off.
  const editorPreview = ref(false);
  const setEditorPreview = (value: boolean) => {
    editorPreview.value = value && editTab.value === "letra";
  };
  watch(editTab, (tab) => {
    if (tab !== "letra") editorPreview.value = false;
  });

  const setEditMode = (value: boolean) =>
    value ? openEditor(editTab.value ?? "cancion") : closeEditor();
  const toggleEditMode = () => setEditMode(!editMode.value);

  // Overlays shared by every screen (mounted once in App.vue)
  const libraryOpen = ref(false);
  const commandPaletteOpen = ref(false);
  const openLibrary = () => {
    commandPaletteOpen.value = false;
    libraryOpen.value = true;
  };
  const closeLibrary = () => {
    libraryOpen.value = false;
  };
  const openCommandPalette = () => {
    libraryOpen.value = false;
    commandPaletteOpen.value = true;
  };
  const closeCommandPalette = () => {
    commandPaletteOpen.value = false;
  };

  return {
    editMode,
    editTab,
    openEditor,
    setEditorTab,
    closeEditor,
    setEditMode,
    toggleEditMode,
    editorPreview,
    setEditorPreview,
    libraryOpen,
    openLibrary,
    closeLibrary,
    commandPaletteOpen,
    openCommandPalette,
    closeCommandPalette
  };
});
