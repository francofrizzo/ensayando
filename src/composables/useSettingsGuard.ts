import {
  computed,
  inject,
  type InjectionKey,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  shallowRef
} from "vue";

/** What a settings section with a save bar tells the view. */
export type SettingsSectionHandle = {
  /** "los datos de la colección", "los colores"… for "Cambiaste …". */
  label: string;
  isDirty: () => boolean;
  /** Saves; shows its own errors. Leaving goes ahead only if nothing stays dirty. */
  save: () => Promise<void>;
  discard: () => void;
  canSave?: () => boolean;
};

export type LeaveChoice = "save" | "discard" | "stay";

export type SettingsGuard = ReturnType<typeof createSettingsGuard>;

const KEY: InjectionKey<SettingsGuard> = Symbol("settings-guard");

export function createSettingsGuard() {
  // Only one section is on screen at a time.
  const section = shallowRef<SettingsSectionHandle | null>(null);
  const pending = ref<((choice: LeaveChoice) => void) | null>(null);

  const isDirty = computed(() => section.value?.isDirty() ?? false);
  const canSave = computed(() => section.value?.canSave?.() ?? true);
  const summary = computed(() =>
    section.value
      ? `Cambiaste ${section.value.label}. Si salís ahora sin guardar, se pierden.`
      : "Hay cambios sin guardar."
  );

  const register = (handle: SettingsSectionHandle) => {
    section.value = handle;
    return () => {
      if (section.value === handle) section.value = null;
    };
  };

  /** Resolves true when it's fine to leave the current section (asking if it's dirty). */
  const confirmLeave = async (): Promise<boolean> => {
    const handle = section.value;
    if (!handle || !handle.isDirty()) return true;
    const choice = await new Promise<LeaveChoice>((resolve) => {
      pending.value = (value) => {
        pending.value = null;
        resolve(value);
      };
    });
    if (choice === "stay") return false;
    if (choice === "discard") {
      handle.discard();
      return true;
    }
    await handle.save();
    return !handle.isDirty();
  };

  return { isDirty, canSave, summary, pending, register, confirmLeave };
}

export function provideSettingsGuard(): SettingsGuard {
  const guard = createSettingsGuard();
  provide(KEY, guard);
  return guard;
}

/** Registers a section's unsaved changes with the view while it's mounted. */
export function useSettingsSection(handle: SettingsSectionHandle) {
  const guard = inject(KEY, null);
  if (!guard) return;
  let unregister: (() => void) | null = null;
  onMounted(() => {
    unregister = guard.register(handle);
  });
  onBeforeUnmount(() => unregister?.());
}
