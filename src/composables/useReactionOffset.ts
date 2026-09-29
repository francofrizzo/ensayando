import { computed, ref } from "vue";

/** Reaction-time correction subtracted from the playback time when marking a verse. */
export const REACTION_OFFSET_STORAGE_KEY = "ens-reaction-offset";
export const DEFAULT_REACTION_OFFSET = 0.2;
export const MIN_REACTION_OFFSET = 0;
export const MAX_REACTION_OFFSET = 1;
export const REACTION_OFFSET_STEP = 0.05;

export const clampReactionOffset = (value: number): number => {
  if (!Number.isFinite(value)) return DEFAULT_REACTION_OFFSET;
  const clamped = Math.min(MAX_REACTION_OFFSET, Math.max(MIN_REACTION_OFFSET, value));
  return Math.round(clamped * 100) / 100;
};

const readStoredOffset = (): number => {
  try {
    const stored = window.localStorage.getItem(REACTION_OFFSET_STORAGE_KEY);
    if (stored === null) return DEFAULT_REACTION_OFFSET;
    return clampReactionOffset(Number(stored));
  } catch {
    return DEFAULT_REACTION_OFFSET;
  }
};

// Module-level state: one correction per device, shared by Letra and Sincronizar.
const offset = ref(readStoredOffset());

const setOffset = (value: number) => {
  offset.value = clampReactionOffset(value);
  try {
    window.localStorage.setItem(REACTION_OFFSET_STORAGE_KEY, String(offset.value));
  } catch {
    // Storage can be unavailable (private mode); the value then lasts for the session.
  }
};

/** Applies the correction to a playback time, never going below zero. */
export const applyReactionOffset = (time: number, correction: number): number =>
  Math.max(0, Math.round((time - correction) * 100) / 100);

export function useReactionOffset() {
  return {
    offset: computed(() => offset.value),
    setOffset,
    nudge: (direction: 1 | -1) => setOffset(offset.value + direction * REACTION_OFFSET_STEP),
    apply: (time: number) => applyReactionOffset(time, offset.value)
  };
}
