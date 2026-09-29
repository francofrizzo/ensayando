/** Symbols for key names, as printed on Mac keyboards and in the deck (⇧ ↵ ⌫). */
const SYMBOLS: Record<string, string> = {
  Shift: "⇧",
  Enter: "↵",
  Backspace: "⌫",
  Escape: "Esc",
  Space: "Espacio"
};

export const prettyKeyParts = (parts: string[]): string[] =>
  parts.map((part) => SYMBOLS[part] ?? part);

/** True when a key event comes from somewhere the user is typing text. */
export const isTypingTarget = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  return !!element?.closest?.("input, textarea, select, [contenteditable='true'], .jse-modal");
};
