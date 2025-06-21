export type Keybinding = {
  key: string;
  modifiers?: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
  };
  preventDefault?: boolean;
  condition?: () => boolean;
};

export type Command = {
  id: string;
  description: string;
  category: string;
  execute: () => void | boolean;
  canExecute?: () => boolean;
  keybinding?: Keybinding;
};

export type CommandRegistry = {
  register(command: Command): void;
  unregister(commandId: string): void;
  execute(commandId: string): boolean;
  getCommand(commandId: string): Command | undefined;
  getCommandsByCategory(): Record<string, Command[]>;
  getAllCommands(): Command[];
  handleKeyboardEvent(event: KeyboardEvent): boolean;
  formatKeybinding(command: Command): string;
  getKeybindingParts(command: Command): string[];
};

const isMac = navigator.platform.toLowerCase().includes("mac");

export function useCommands(): CommandRegistry {
  const commands = new Map<string, Command>();

  const register = (command: Command) => {
    commands.set(command.id, command);
  };

  const unregister = (commandId: string) => {
    commands.delete(commandId);
  };

  const execute = (commandId: string): boolean => {
    const command = commands.get(commandId);
    if (!command) return false;

    if (command.canExecute && !command.canExecute()) {
      return false;
    }

    const result = command.execute();
    return result !== false;
  };

  const getCommand = (commandId: string): Command | undefined => {
    return commands.get(commandId);
  };

  const getCommandsByCategory = (): Record<string, Command[]> => {
    const categories: Record<string, Command[]> = {};

    commands.forEach((command) => {
      if (!categories[command.category]) {
        categories[command.category] = [];
      }
      categories[command.category]!.push(command);
    });

    return categories;
  };

  const getAllCommands = (): Command[] => {
    return Array.from(commands.values());
  };

  const matchKeybinding = (event: KeyboardEvent): Command | undefined => {
    return Array.from(commands.values()).find((command) => {
      if (!command.keybinding) return false;

      if (command.keybinding.key.toLowerCase() !== event.key.toLowerCase()) {
        return false;
      }

      const { modifiers = {} } = command.keybinding;

      // On Mac, Ctrl modifier maps to Cmd key (metaKey)
      // On other platforms, Ctrl modifier maps to ctrlKey
      const expectedCtrl = isMac ? event.metaKey : event.ctrlKey;
      const expectedMeta = isMac ? false : event.metaKey; // Meta key is rarely used on Mac

      return (
        !!modifiers.ctrl === expectedCtrl &&
        !!modifiers.alt === event.altKey &&
        !!modifiers.shift === event.shiftKey &&
        !!modifiers.meta === expectedMeta
      );
    });
  };

  const handleKeyboardEvent = (event: KeyboardEvent): boolean => {
    const command = matchKeybinding(event);
    if (!command || !command.keybinding) return false;

    // Check keybinding condition if it exists
    if (command.keybinding.condition && !command.keybinding.condition()) {
      return false;
    }

    // Check command canExecute condition
    if (command.canExecute && !command.canExecute()) {
      return false;
    }

    // Execute the command
    const result = command.execute();
    const success = result !== false;

    if (success && (command.keybinding.preventDefault !== false || result === true)) {
      event.preventDefault();
      return true;
    }

    return success;
  };

  const formatKeybinding = (command: Command): string => {
    if (!command.keybinding) return "";

    const parts: string[] = [];
    const { modifiers = {} } = command.keybinding;

    if (modifiers.ctrl) {
      parts.push(isMac ? "⌘" : "Ctrl");
    }
    if (modifiers.alt) {
      parts.push(isMac ? "⌥" : "Alt");
    }
    if (modifiers.shift) {
      parts.push("Shift");
    }
    if (modifiers.meta && !isMac) {
      parts.push("Meta");
    }

    const keyMap: Record<string, string> = {
      " ": "Space",
      Enter: "Enter",
      Backspace: isMac ? "⌫" : "Backspace",
      ArrowUp: "↑",
      ArrowDown: "↓",
      ArrowLeft: "←",
      ArrowRight: "→",
      F1: "F1",
      Tab: "Tab",
      ",": ",",
      ".": ".",
      "/": "/",
      "\\": "\\",
      "[": "[",
      "]": "]"
    };

    const keyName = keyMap[command.keybinding.key] || command.keybinding.key.toUpperCase();
    parts.push(keyName);

    return parts.join("+");
  };

  const getKeybindingParts = (command: Command): string[] => {
    if (!command.keybinding) return [];

    const parts: string[] = [];
    const { modifiers = {} } = command.keybinding;

    if (modifiers.ctrl) {
      parts.push(isMac ? "⌘" : "Ctrl");
    }
    if (modifiers.alt) {
      parts.push(isMac ? "⌥" : "Alt");
    }
    if (modifiers.shift) {
      parts.push("Shift");
    }
    if (modifiers.meta && !isMac) {
      parts.push("Meta");
    }

    const keyMap: Record<string, string> = {
      " ": "Space",
      Enter: "Enter",
      Backspace: isMac ? "⌫" : "Backspace",
      ArrowUp: "↑",
      ArrowDown: "↓",
      ArrowLeft: "←",
      ArrowRight: "→",
      F1: "F1",
      Tab: "Tab",
      ",": ",",
      ".": ".",
      "/": "/",
      "\\": "\\",
      "[": "[",
      "]": "]"
    };

    const keyName = keyMap[command.keybinding.key] || command.keybinding.key.toUpperCase();
    parts.push(keyName);

    return parts;
  };

  return {
    register,
    unregister,
    execute,
    getCommand,
    getCommandsByCategory,
    getAllCommands,
    handleKeyboardEvent,
    formatKeybinding,
    getKeybindingParts
  };
}
