import { defineStore } from "pinia";
import { ref, watch } from "vue";

import { useCollectionsStore } from "@/stores/collections";

export const useUIStore = defineStore("ui", () => {
  const editMode = ref(false);

  const setEditMode = (value: boolean) => {
    editMode.value = value;
  };

  const toggleEditMode = () => {
    editMode.value = !editMode.value;
  };

  // Reset edit mode when the user cannot edit the current collection
  const collectionsStore = useCollectionsStore();
  watch(
    () => collectionsStore.canEditCurrentCollection,
    (canEdit) => {
      if (!canEdit && editMode.value) {
        setEditMode(false);
      }
    }
  );

  return {
    editMode,
    setEditMode,
    toggleEditMode
  };
});
