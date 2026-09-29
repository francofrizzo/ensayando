<script setup lang="ts">
import { computed } from "vue";

import LeaveDialog from "@/components/ui/LeaveDialog.vue";
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
</script>

<template>
  <LeaveDialog
    :open="open"
    :summary="summary"
    :can-save="session.canSave.value"
    @choose="(choice) => session.pendingLeave.value?.(choice)"
  />
</template>
