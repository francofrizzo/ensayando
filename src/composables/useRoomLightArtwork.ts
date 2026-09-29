import { computed, type Ref, ref, watch } from "vue";

// "Usar la portada como luz de sala" (Ajustes · General). Stored per collection on
// this device; defaults to on. RoomLight reads it to decide between the colored glows
// and the blurred artwork.
const KEY = (collectionId: number) => `ens-room-artwork-${collectionId}`;

function read(collectionId: number): boolean {
  try {
    return window.localStorage.getItem(KEY(collectionId)) !== "off";
  } catch {
    return true;
  }
}

const versions = ref(0);

export function useRoomLightArtwork(collectionId: Ref<number | null | undefined>) {
  const stored = ref(collectionId.value ? read(collectionId.value) : true);
  watch([collectionId, versions], () => {
    stored.value = collectionId.value ? read(collectionId.value) : true;
  });

  const useArtwork = computed({
    get: () => stored.value,
    set: (value: boolean) => {
      stored.value = value;
      if (!collectionId.value) return;
      try {
        window.localStorage.setItem(KEY(collectionId.value), value ? "on" : "off");
      } catch {
        // Private mode: the choice lasts until reload.
      }
      versions.value++;
    }
  });

  return { useArtwork };
}
