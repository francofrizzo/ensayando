import type { FocusPosition } from "@/utils/lyricsPositionUtils";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useCommands, type Command } from "./useCommands";

export type LyricsCommandActions = {
  navigateVertical: (direction: "up" | "down") => void;
  navigateHorizontal: (direction: "left" | "right") => void;
  insertLineWithInheritance: (before?: boolean) => void;
  insertLineOutsideColumn: (before?: boolean) => void;
  deleteLine: () => void;
  handleSmartBackspace: () => boolean;
  duplicateLineWithInheritance: () => void;
  toggleCopyPropertiesToMode: () => void;
  exitCopyPropertiesToMode: () => void;
  convertToColumns: () => void;
  insertColumn: (before?: boolean) => void;
  insertStanza: () => void;
  setCurrentVerseStartTime: () => void;
  setCurrentVerseEndTime: () => void;
  clearCurrentVerseStartTime: () => void;
  clearCurrentVerseEndTime: () => void;
  clearCurrentVerseBothTimes: () => void;
};

export function useLyricsCommands(
  currentFocus: () => FocusPosition | null,
  isColumnContext: (position: FocusPosition) => boolean,
  actions: LyricsCommandActions,
  onSave?: () => void,
  isCopyModeActive?: () => boolean
) {
  const showHelp = ref(false);
  const commandRegistry = useCommands();

  const canPerformActions = computed(() => currentFocus() !== null);
  const hasColumnContext = computed(() => {
    const focus = currentFocus();
    return focus ? isColumnContext(focus) : false;
  });

  const commands: Command[] = [
    {
      id: "navigate-up",
      description: "Navegar hacia arriba",
      category: "Navegación",
      execute: () => actions.navigateVertical("up"),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "ArrowUp"
      }
    },
    {
      id: "navigate-down",
      description: "Navegar hacia abajo",
      category: "Navegación",
      execute: () => actions.navigateVertical("down"),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "ArrowDown"
      }
    },
    {
      id: "navigate-left",
      description: "Moverse dentro del texto / Navegar entre columnas",
      category: "Navegación",
      execute: () => actions.navigateHorizontal("left"),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "ArrowLeft",
        preventDefault: false
      }
    },
    {
      id: "navigate-right",
      description: "Moverse dentro del texto / Navegar entre columnas",
      category: "Navegación",
      execute: () => actions.navigateHorizontal("right"),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "ArrowRight",
        preventDefault: false
      }
    },

    {
      id: "insert-line",
      description: "Insertar nuevo verso después del actual",
      category: "Operaciones de versos",
      execute: () => actions.insertLineWithInheritance(false),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "Enter"
      }
    },
    {
      id: "insert-line-before",
      description: "Insertar nuevo verso antes del actual",
      category: "Operaciones de versos",
      execute: () => actions.insertLineWithInheritance(true),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "Enter",
        modifiers: { alt: true }
      }
    },
    {
      id: "insert-line-outside-after",
      description: "Insertar verso fuera de columnas (después)",
      category: "Operaciones de versos",
      execute: () => actions.insertLineOutsideColumn(false),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "Enter",
        modifiers: { shift: true }
      }
    },
    {
      id: "insert-line-outside-before",
      description: "Insertar verso fuera de columnas (antes)",
      category: "Operaciones de versos",
      execute: () => actions.insertLineOutsideColumn(true),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "Enter",
        modifiers: { shift: true, alt: true }
      }
    },
    {
      id: "delete-line",
      description: "Eliminar verso actual",
      category: "Operaciones de versos",
      execute: () => actions.deleteLine(),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "Backspace",
        modifiers: { ctrl: true }
      }
    },
    {
      id: "smart-backspace",
      description: "Eliminar verso vacío automáticamente",
      category: "Operaciones de versos",
      execute: () => {
        const handled = actions.handleSmartBackspace();
        return handled;
      },
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "Backspace"
      }
    },
    {
      id: "duplicate-line",
      description: "Duplicar verso actual",
      category: "Operaciones de versos",
      execute: () => actions.duplicateLineWithInheritance(),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "d",
        modifiers: { ctrl: true }
      }
    },
    {
      id: "copy-properties",
      description: "Copiar colores y pistas de audio a otros versos",
      category: "Operaciones de versos",
      execute: () => actions.toggleCopyPropertiesToMode(),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "k",
        modifiers: { ctrl: true }
      }
    },
    {
      id: "exit-copy-mode",
      description: "Salir del modo copiar propiedades",
      category: "Operaciones de versos",
      execute: () => actions.exitCopyPropertiesToMode(),
      canExecute: () => canPerformActions.value && (isCopyModeActive ? isCopyModeActive() : false),
      keybinding: {
        key: "Escape"
      }
    },

    {
      id: "convert-to-columns",
      description: "Convertir en un verso con múltiples columnas",
      category: "Operaciones de columnas",
      execute: () => actions.convertToColumns(),
      canExecute: () => canPerformActions.value && !hasColumnContext.value,
      keybinding: {
        key: "]",
        modifiers: { ctrl: true }
      }
    },
    {
      id: "insert-column-right",
      description: "Insertar columna a la derecha",
      category: "Operaciones de columnas",
      execute: () => actions.insertColumn(false),
      canExecute: () => canPerformActions.value && hasColumnContext.value,
      keybinding: {
        key: "]",
        modifiers: { ctrl: true }
      }
    },
    {
      id: "insert-column-left",
      description: "Insertar columna a la izquierda",
      category: "Operaciones de columnas",
      execute: () => actions.insertColumn(true),
      canExecute: () => canPerformActions.value && hasColumnContext.value,
      keybinding: {
        key: "[",
        modifiers: { ctrl: true }
      }
    },

    {
      id: "insert-stanza",
      description: "Insertar nueva estrofa",
      category: "Operaciones de estrofas",
      execute: () => actions.insertStanza(),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "Enter",
        modifiers: { ctrl: true }
      }
    },

    {
      id: "set-start-time",
      description: "Establecer tiempo de inicio del verso",
      category: "Marcas de tiempo",
      execute: () => actions.setCurrentVerseStartTime(),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: ",",
        modifiers: { ctrl: true }
      }
    },
    {
      id: "set-end-time",
      description: "Establecer tiempo de finalización del verso",
      category: "Marcas de tiempo",
      execute: () => actions.setCurrentVerseEndTime(),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: ".",
        modifiers: { ctrl: true }
      }
    },
    {
      id: "clear-start-time",
      description: "Limpiar tiempo de inicio",
      category: "Marcas de tiempo",
      execute: () => actions.clearCurrentVerseStartTime(),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: ",",
        modifiers: { ctrl: true, shift: true }
      }
    },
    {
      id: "clear-end-time",
      description: "Limpiar tiempo de finalización",
      category: "Marcas de tiempo",
      execute: () => actions.clearCurrentVerseEndTime(),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: ".",
        modifiers: { ctrl: true, shift: true }
      }
    },
    {
      id: "clear-both-times",
      description: "Limpiar ambos tiempos",
      category: "Marcas de tiempo",
      execute: () => actions.clearCurrentVerseBothTimes(),
      canExecute: () => canPerformActions.value,
      keybinding: {
        key: "/",
        modifiers: { ctrl: true }
      }
    },

    {
      id: "save",
      description: "Guardar cambios",
      category: "Acciones rápidas",
      execute: () => onSave?.(),
      canExecute: () => !!onSave,
      keybinding: {
        key: "s",
        modifiers: { ctrl: true }
      }
    },
    {
      id: "toggle-help",
      description: "Mostrar/ocultar esta ayuda",
      category: "Acciones rápidas",
      execute: () => {
        showHelp.value = !showHelp.value;
      },
      keybinding: {
        key: "F1"
      }
    }
  ];

  commands.forEach((command) => {
    commandRegistry.register(command);
  });

  const handleKeydown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;

    // Allow ESC key to work globally (not just on input elements)
    if (event.key === "Escape") {
      commandRegistry.handleKeyboardEvent(event);
      return;
    }

    // For other keys, only handle when focused on input elements
    if (!target.hasAttribute("data-input")) return;

    commandRegistry.handleKeyboardEvent(event);
  };

  onMounted(() => {
    document.addEventListener("keydown", handleKeydown);
  });

  onUnmounted(() => {
    document.removeEventListener("keydown", handleKeydown);
  });

  return {
    showHelp,
    commandRegistry
  };
}
