<script setup lang="ts">
import { createJSONEditor } from "vanilla-jsoneditor";
import { onBeforeUnmount, onMounted, onUpdated, ref, type Ref } from "vue";

interface JsonEditorProps {
  content?: any;
  selection?: any;
  readOnly?: boolean;
  indentation?: number | string;
  tabSize?: number;
  mode?: string;
  mainMenuBar?: boolean;
  navigationBar?: boolean;
  statusBar?: boolean;
  askToFormat?: boolean;
  escapeControlCharacters?: boolean;
  escapeUnicodeCharacters?: boolean;
  flattenColumns?: boolean;
  parser?: any;
  validator?: any;
  validationParser?: any;
  pathParser?: any;
  queryLanguages?: any[];
  queryLanguageId?: string;
  onChangeQueryLanguage?: Function;
  onChange?: Function;
  onRenderValue?: Function;
  onClassName?: Function;
  onRenderMenu?: Function;
  onRenderContextMenu?: Function;
  onChangeMode?: Function;
  onSelect?: Function;
  onError?: Function;
  onFocus?: Function;
  onBlur?: Function;
}

// JSONEditor properties as of version 2.3.1
const supportedPropNames: (keyof JsonEditorProps)[] = [
  "content",
  "selection",
  "readOnly",
  "indentation",
  "tabSize",
  "mode",
  "mainMenuBar",
  "navigationBar",
  "statusBar",
  "askToFormat",
  "escapeControlCharacters",
  "escapeUnicodeCharacters",
  "flattenColumns",
  "parser",
  "validator",
  "validationParser",
  "pathParser",
  "queryLanguages",
  "queryLanguageId",
  "onChangeQueryLanguage",
  "onChange",
  "onRenderValue",
  "onClassName",
  "onRenderMenu",
  "onRenderContextMenu",
  "onChangeMode",
  "onSelect",
  "onError",
  "onFocus",
  "onBlur"
];

const supportedPropNamesSet = new Set(supportedPropNames);

function filterProps(props: JsonEditorProps, prevProps: JsonEditorProps): Partial<JsonEditorProps> {
  return Object.fromEntries(
    Object.entries(props)
      .filter(([key]) => supportedPropNamesSet.has(key as keyof JsonEditorProps))
      .filter(([, value]) => value !== undefined) // Don't pass undefined values
      .filter(([key, value]) => value !== prevProps[key as keyof JsonEditorProps])
  ) as Partial<JsonEditorProps>;
}

const props = withDefaults(defineProps<JsonEditorProps>(), {
  content: undefined,
  selection: undefined,
  readOnly: undefined,
  indentation: undefined,
  tabSize: undefined,
  mode: undefined,
  mainMenuBar: undefined,
  navigationBar: undefined,
  statusBar: undefined,
  askToFormat: undefined,
  escapeControlCharacters: undefined,
  escapeUnicodeCharacters: undefined,
  flattenColumns: undefined,
  parser: undefined,
  validator: undefined,
  validationParser: undefined,
  pathParser: undefined,
  queryLanguages: undefined,
  queryLanguageId: undefined,
  onChangeQueryLanguage: undefined,
  onChange: undefined,
  onRenderValue: undefined,
  onClassName: undefined,
  onRenderMenu: undefined,
  onRenderContextMenu: undefined,
  onChangeMode: undefined,
  onSelect: undefined,
  onError: undefined,
  onFocus: undefined,
  onBlur: undefined
});

// Reactive references
const editorRef: Ref<HTMLElement | null> = ref(null);
const editor: Ref<any> = ref(null);
const prevProps: Ref<Partial<JsonEditorProps>> = ref({});

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
    console.log("create editor", editor.value, filteredProps);
  }
});

onUpdated(() => {
  if (editor.value) {
    const updatedProps = filterProps(props, prevProps.value);
    console.log("update props", updatedProps);
    prevProps.value = { ...prevProps.value, ...updatedProps };
    editor.value.updateProps(updatedProps);
  }
});

onBeforeUnmount(() => {
  if (editor.value) {
    console.log("destroy editor");
    editor.value.destroy();
    editor.value = null;
  }
});
</script>

<template>
  <div ref="editorRef" />
</template>
