<script setup lang="ts">
import { createJSONEditor, type JSONEditorPropsOptional } from "vanilla-jsoneditor";
import { onBeforeUnmount, onMounted, onUpdated, ref, type Ref } from "vue";

function filterProps(
  props: JSONEditorPropsOptional,
  prevProps: JSONEditorPropsOptional
): Partial<JSONEditorPropsOptional> {
  return Object.fromEntries(
    Object.entries(props)
      .filter(([, value]) => value !== undefined) // Don't pass undefined values
      .filter(([key, value]) => value !== prevProps[key as keyof JSONEditorPropsOptional])
  ) as Partial<JSONEditorPropsOptional>;
}

const props = defineProps<JSONEditorPropsOptional>();

// Reactive references
const editorRef: Ref<HTMLElement | null> = ref(null);
const editor: Ref<any> = ref(null);
const prevProps: Ref<Partial<JSONEditorPropsOptional>> = ref({});

onMounted(() => {
  // filter the props that actually changed
  // since the last time to prevent syncing issues
  const filteredProps = filterProps(props, {});
  prevProps.value = filteredProps;

  if (editorRef.value) {
    editor.value = createJSONEditor({
      target: editorRef.value,
      props: filteredProps
    });
  }
});

onUpdated(() => {
  if (editor.value) {
    const updatedProps = filterProps(props, prevProps.value);

    prevProps.value = { ...prevProps.value, ...updatedProps };
    editor.value.updateProps(updatedProps);
  }
});

onBeforeUnmount(() => {
  if (editor.value) {
    editor.value.destroy();
    editor.value = null;
  }
});
</script>

<template>
  <div ref="editorRef" />
</template>
