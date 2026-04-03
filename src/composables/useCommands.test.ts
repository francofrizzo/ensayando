import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCommands } from "@/composables/useCommands";
import type { Command } from "@/composables/useCommands";

// navigator.platform defaults to "" in happy-dom, so isMac = false

function createRegistry() {
  return useCommands();
}

function fakeKeyEvent(
  key: string,
  opts: Partial<KeyboardEvent> = {}
): KeyboardEvent {
  return {
    key,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    preventDefault: vi.fn(),
    ...opts
  } as unknown as KeyboardEvent;
}

describe("useCommands", () => {
  let registry: ReturnType<typeof useCommands>;

  beforeEach(() => {
    registry = createRegistry();
  });

  it("registers a command and executes it by ID", () => {
    const execute = vi.fn();
    registry.register({
      id: "test.cmd",
      description: "Test",
      category: "test",
      execute
    });

    const result = registry.execute("test.cmd");
    expect(result).toBe(true);
    expect(execute).toHaveBeenCalledOnce();
  });

  it("returns false when executing unknown command ID", () => {
    expect(registry.execute("nonexistent")).toBe(false);
  });

  it("respects canExecute returning false", () => {
    const execute = vi.fn();
    registry.register({
      id: "test.guarded",
      description: "Guarded",
      category: "test",
      execute,
      canExecute: () => false
    });

    const result = registry.execute("test.guarded");
    expect(result).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  describe("matchKeybinding (non-Mac)", () => {
    it("matches a simple key", () => {
      const cmd: Command = {
        id: "test.space",
        description: "Space",
        category: "test",
        execute: vi.fn(),
        keybinding: { key: " " }
      };
      registry.register(cmd);

      registry.handleKeyboardEvent(fakeKeyEvent(" "));
      expect(cmd.execute).toHaveBeenCalled();
    });

    it("matches key with ctrl modifier (non-Mac: ctrlKey)", () => {
      const cmd: Command = {
        id: "test.save",
        description: "Save",
        category: "test",
        execute: vi.fn(),
        keybinding: { key: "s", modifiers: { ctrl: true } }
      };
      registry.register(cmd);

      const event = fakeKeyEvent("s", { ctrlKey: true });
      registry.handleKeyboardEvent(event);
      expect(cmd.execute).toHaveBeenCalledOnce();
    });

    it("does NOT match when extra modifiers are pressed", () => {
      const cmd: Command = {
        id: "test.simple",
        description: "Simple key",
        category: "test",
        execute: vi.fn(),
        keybinding: { key: "a" }
      };
      registry.register(cmd);

      // Press 'a' with unexpected ctrl
      const event = fakeKeyEvent("a", { ctrlKey: true });
      const result = registry.handleKeyboardEvent(event);
      expect(result).toBe(false);
      expect(cmd.execute).not.toHaveBeenCalled();
    });
  });

  describe("handleKeyboardEvent", () => {
    it("calls preventDefault when command succeeds", () => {
      registry.register({
        id: "test.prevent",
        description: "Prevent",
        category: "test",
        execute: vi.fn(),
        keybinding: { key: "p" }
      });

      const event = fakeKeyEvent("p");
      registry.handleKeyboardEvent(event);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it("does NOT call preventDefault when preventDefault is false", () => {
      registry.register({
        id: "test.noprevent",
        description: "No prevent",
        category: "test",
        execute: vi.fn(),
        keybinding: { key: "n", preventDefault: false }
      });

      const event = fakeKeyEvent("n");
      registry.handleKeyboardEvent(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe("priority resolution", () => {
    it("picks the executable command when two share the same key", () => {
      const disabledExecute = vi.fn();
      const enabledExecute = vi.fn();

      registry.register({
        id: "test.disabled",
        description: "Disabled",
        category: "test",
        execute: disabledExecute,
        canExecute: () => false,
        keybinding: { key: "x" }
      });

      registry.register({
        id: "test.enabled",
        description: "Enabled",
        category: "test",
        execute: enabledExecute,
        keybinding: { key: "x" }
      });

      const event = fakeKeyEvent("x");
      const result = registry.handleKeyboardEvent(event);
      expect(result).toBe(true);
      expect(enabledExecute).toHaveBeenCalledOnce();
      expect(disabledExecute).not.toHaveBeenCalled();
    });
  });
});
