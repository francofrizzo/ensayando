import { onBeforeUnmount, onMounted, ref, type Ref } from "vue";

/**
 * Composable to safely handle Teleport targets that might not exist immediately
 * @param selector - CSS selector for the teleport target
 * @returns reactive reference to the target element
 */
export function useTeleportTarget(selector: string): {
  target: Ref<Element | null>;
  isReady: Ref<boolean>;
} {
  const target = ref<Element | null>(null);
  const isReady = ref<boolean>(false);
  let observer: MutationObserver | null = null;

  const checkTarget = () => {
    const element = document.querySelector(selector);
    target.value = element;
    isReady.value = !!element;
  };

  const setupObserver = () => {
    if (observer) return;

    observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          checkTarget();
          if (target.value && observer) {
            observer.disconnect();
            observer = null;
          }
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  };

  const cleanup = () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  };

  onMounted(() => {
    checkTarget();

    if (!target.value) {
      setupObserver();
    }
  });

  onBeforeUnmount(() => {
    cleanup();
  });

  return {
    target,
    isReady
  };
}
