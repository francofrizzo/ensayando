import { nextTick, onUnmounted, type Ref, watch } from "vue";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Focus handling for an overlay: moves focus in when it opens (to `initial`, or
 * the first focusable element), keeps Tab inside it, closes on Escape and gives
 * focus back to whatever had it before.
 */
export function useDialogFocus(options: {
  open: Readonly<Ref<boolean>>;
  container: Readonly<Ref<HTMLElement | null | undefined>>;
  initial?: Readonly<Ref<HTMLElement | null | undefined>>;
  onClose: () => void;
}) {
  let previous: HTMLElement | null = null;

  const focusables = () =>
    Array.from(options.container.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );

  const onKeydown = (event: KeyboardEvent) => {
    if (!options.open.value) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      options.onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const items = focusables();
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !options.container.value?.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  watch(options.open, async (isOpen) => {
    if (isOpen) {
      previous = document.activeElement as HTMLElement | null;
      document.addEventListener("keydown", onKeydown, true);
      await nextTick();
      (options.initial?.value ?? focusables()[0])?.focus();
    } else {
      document.removeEventListener("keydown", onKeydown, true);
      previous?.focus?.();
      previous = null;
    }
  });

  onUnmounted(() => document.removeEventListener("keydown", onKeydown, true));
}
