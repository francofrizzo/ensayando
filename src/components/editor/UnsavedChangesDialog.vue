<script setup lang="ts">
import { computed, ref, watch } from "vue";

import { IconWarning } from "@/components/ui/icons";
import { useDialogFocus } from "@/composables/useDialogFocus";
import { EDITOR_TABS, type EditorTabId, useEditorSession } from "@/composables/useEditorSession";

const session = useEditorSession();
const open = computed(() => session.pendingLeave.value !== null);

const WHAT: Record<EditorTabId, string> = {
  cancion: "los datos de la canción",
  letra: "la letra",
  sincronizar: "los tiempos"
};
const dirtyLabels = computed(() =>
  EDITOR_TABS.filter((tab) => session.dirtyByTab.value[tab.id]).map((tab) => WHAT[tab.id])
);
const summary = computed(() => {
  const labels = dirtyLabels.value;
  if (labels.length === 0) return "Hay cambios sin guardar.";
  const list =
    labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`;
  return `Cambiaste ${list}. Si salís ahora sin guardar, se pierden.`;
});

const dialog = ref<HTMLElement | null>(null);
useDialogFocus({
  open,
  container: dialog,
  onClose: () => session.pendingLeave.value?.("stay")
});

const saving = ref(false);
watch(open, (isOpen) => {
  if (!isOpen) saving.value = false;
});

const choose = (choice: "save" | "discard" | "stay") => {
  if (choice === "save") saving.value = true;
  session.pendingLeave.value?.(choice);
};
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[70] flex items-end justify-center bg-black/30 p-3 backdrop-blur-[3px] sm:items-center"
      @click.self="choose('stay')"
    >
      <div
        ref="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-title"
        aria-describedby="unsaved-desc"
        class="glass-3 rounded-box flex w-full max-w-md flex-col gap-4 p-5"
        data-testid="unsaved-dialog"
      >
        <div class="flex items-start gap-3">
          <span
            class="bg-warning/15 text-warning grid size-9 shrink-0 place-items-center rounded-full"
          >
            <IconWarning class="size-5" />
          </span>
          <div class="flex flex-col gap-1">
            <h2 id="unsaved-title" class="font-display text-lg font-bold">¿Salir sin guardar?</h2>
            <p id="unsaved-desc" class="text-base-content/70 text-sm">{{ summary }}</p>
          </div>
        </div>
        <div class="flex flex-wrap justify-end gap-2">
          <button class="btn btn-sm btn-ghost rounded-full font-semibold" @click="choose('stay')">
            Seguir editando
          </button>
          <button
            class="btn btn-sm text-error bg-error/10 hover:bg-error/15 rounded-full border-0 font-semibold shadow-none"
            data-testid="unsaved-discard"
            @click="choose('discard')"
          >
            Descartar y salir
          </button>
          <button
            class="btn btn-sm btn-primary rounded-full font-semibold"
            :disabled="!session.canSave.value || saving"
            data-testid="unsaved-save"
            @click="choose('save')"
          >
            <span v-if="saving" class="loading loading-spinner loading-xs" />
            Guardar y salir
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
