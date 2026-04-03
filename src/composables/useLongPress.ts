import { onUnmounted, ref } from "vue";

import { isMac } from "@/utils/platform";

type LongPressActions = {
  tap: (shiftKey: boolean) => void;
  longPress: () => void;
}

/**
 * Unified tap / long-press handling for buttons that need a primary action
 * (tap/click) and a secondary action (long-press on touch, ctrl/cmd+click
 * on desktop).
 *
 * Usage:
 *   const muteButton = useLongPress({ tap: ..., longPress: ... });
 *   <button v-on="muteButton">
 */
export function useLongPress(actions: LongPressActions, duration = 500) {
  const timer = ref<number | null>(null);
  const longPressActive = ref(false);

  const clearTimer = () => {
    if (timer.value) {
      clearTimeout(timer.value);
      timer.value = null;
    }
  };

  onUnmounted(clearTimer);

  return {
    touchstart(e: TouchEvent) {
      e.preventDefault();
      longPressActive.value = false;
      timer.value = window.setTimeout(() => {
        longPressActive.value = true;
        actions.longPress();
      }, duration);
    },
    touchend() {
      clearTimer();
      if (!longPressActive.value) {
        actions.tap(false);
      }
    },
    touchcancel() {
      clearTimer();
      longPressActive.value = false;
    },
    click(event: MouseEvent) {
      if (longPressActive.value) {
        event.preventDefault();
        return;
      }
      const isCtrlOrCmd = isMac ? event.metaKey : event.ctrlKey;
      if (isCtrlOrCmd) {
        actions.longPress();
      } else {
        actions.tap(event.shiftKey);
      }
    },
  };
}
