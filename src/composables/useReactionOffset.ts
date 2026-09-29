import { ref, type Ref, watch } from "vue";

export const REACTION_OFFSET_KEY = "ens-reaction-offset";
export const DEFAULT_REACTION_OFFSET = 0.2;

const read = (): number => {
  try {
    const value = Number(window.localStorage.getItem(REACTION_OFFSET_KEY));
    return window.localStorage.getItem(REACTION_OFFSET_KEY) !== null && Number.isFinite(value)
      ? Math.min(Math.max(value, 0), 1)
      : DEFAULT_REACTION_OFFSET;
  } catch {
    return DEFAULT_REACTION_OFFSET;
  }
};

// One value per device, shared by Letra and Sincronizar.
const offset = ref(read());
watch(offset, (value) => {
  try {
    window.localStorage.setItem(REACTION_OFFSET_KEY, String(value));
  } catch {
    // storage blocked: keep the value for this session only
  }
});

/** Seconds subtracted from the playback time when marking, to make up for reaction time. */
export function useReactionOffset(): Ref<number> {
  return offset;
}
