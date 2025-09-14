import { defineStore } from "pinia";
import { ref } from "vue";

type AutoplaySelection = {
  mode: "all" | "subset";
  colorKeys: string[];
};

export const usePlayerStore = defineStore("player", () => {
  const autoplayEnabled = ref(false);
  const shouldAutoStartNextSong = ref(false);

  const selectionByCollectionId = ref<Record<number, AutoplaySelection>>({});

  const setAutoplayEnabled = (value: boolean) => {
    autoplayEnabled.value = value;
  };

  const rememberSelection = (collectionId: number, selectedColorKeys: string[], isAll: boolean) => {
    selectionByCollectionId.value[collectionId] = {
      mode: isAll ? "all" : "subset",
      colorKeys: selectedColorKeys
    };
  };

  const getSelection = (collectionId: number) => {
    return selectionByCollectionId.value[collectionId] || null;
  };

  const setShouldAutoStartNextSong = (value: boolean) => {
    shouldAutoStartNextSong.value = value;
  };

  return {
    autoplayEnabled,
    shouldAutoStartNextSong,
    selectionByCollectionId,
    setAutoplayEnabled,
    rememberSelection,
    getSelection,
    setShouldAutoStartNextSong
  };
});
