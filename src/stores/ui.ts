import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { useAuthStore } from "./auth";

export const useUIStore = defineStore("ui", () => {
  const editMode = ref(false);

  const setEditMode = (value: boolean) => {
    editMode.value = value;
  };

  const toggleEditMode = () => {
    editMode.value = !editMode.value;
  };

  // Watch authentication state and reset edit mode when user logs out
  const authStore = useAuthStore();
  watch(
    () => authStore.isAuthenticated,
    (isAuthenticated) => {
      if (!isAuthenticated && editMode.value) {
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
