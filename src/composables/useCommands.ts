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

const keyMap: Record<string, string> = {
  " ": "Space",
  Enter: "Enter",
  Backspace: "Backspace",
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

  const canCommandExecute = (command: Command): boolean => {
    if (command.keybinding?.condition && !command.keybinding.condition()) {
      return false;
    }
    if (command.canExecute && !command.canExecute()) {
      return false;
    }
    return true;
  };

  const matchKeybinding = (event: KeyboardEvent): Command | undefined => {
    const matchingCommands = Array.from(commands.values()).filter((command) => {
      if (!command.keybinding) return false;

      if (command.keybinding.key.toLowerCase() !== event.key.toLowerCase()) {
        return false;
      }

      const { modifiers = {} } = command.keybinding;

      // On Mac, Ctrl modifier maps to Cmd key (metaKey), on other platforms to ctrlKey
      const expectedCtrl = isMac ? event.metaKey : event.ctrlKey;
      const expectedMeta = isMac ? false : event.metaKey;

      return (
        !!modifiers.ctrl === expectedCtrl &&
        !!modifiers.alt === event.altKey &&
        !!modifiers.shift === event.shiftKey &&
        !!modifiers.meta === expectedMeta
      );
    });

    // Prioritize commands that can execute
    const executableCommand = matchingCommands.find(canCommandExecute);
    return executableCommand || matchingCommands[0];
  };

  const handleKeyboardEvent = (event: KeyboardEvent): boolean => {
    const command = matchKeybinding(event);
    if (!command || !command.keybinding) return false;

    if (!canCommandExecute(command)) {
      return false;
    }

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
