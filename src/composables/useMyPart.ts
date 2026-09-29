import { computed, ref, watch, type Ref } from "vue";

import type { MyPartState } from "@/composables/usePlayerState";
import { EMPTY_MY_PART, myPartStorageKey, parseMyPart } from "@/utils/myPart";

const read = (collectionId: number): MyPartState => {
  try {
    return parseMyPart(window.localStorage.getItem(myPartStorageKey(collectionId)));
  } catch {
    return EMPTY_MY_PART;
  }
};

/**
 * "Mi parte": the tracks a person sings, remembered per collection on this device.
 * Track ids from other songs of the collection are kept, so the choice survives
 * moving between songs that share track ids.
 */
export function useMyPart(collectionId: Ref<number>) {
  const part = ref<MyPartState>(read(collectionId.value));

  watch(collectionId, (id) => {
    part.value = read(id);
  });

  const save = (value: MyPartState) => {
    part.value = value;
    try {
      window.localStorage.setItem(myPartStorageKey(collectionId.value), JSON.stringify(value));
    } catch {
      // Storage can be unavailable (private mode); the choice lasts for the session.
    }
  };

  const toggleTrack = (trackId: number) => {
    const ids = part.value.trackIds.includes(trackId)
      ? part.value.trackIds.filter((id) => id !== trackId)
      : [...part.value.trackIds, trackId];
    save({ ...part.value, trackIds: ids });
  };

  const setDuckOthers = (duckOthers: boolean) => save({ ...part.value, duckOthers });
  const clear = () => save({ ...part.value, trackIds: [] });

  return {
    part: computed(() => part.value),
    toggleTrack,
    setDuckOthers,
    clear
  };
}
