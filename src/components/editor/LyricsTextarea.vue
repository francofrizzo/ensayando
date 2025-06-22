<script setup lang="ts">
import { onMounted, ref } from "vue";

type Props = {
  modelValue: string;
  dataLyricsInput: string;
  verseStyles: Record<string, any>;
  readonly?: boolean;
  placeholder?: string;
};

type Emits = {
  (e: "update:modelValue", value: string): void;
  (e: "focus"): void;
};

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  placeholder: ""
});

const emit = defineEmits<Emits>();

const textareaRef = ref<HTMLTextAreaElement>();

const updateValue = (event: Event) => {
  const target = event.target as HTMLTextAreaElement;
  emit("update:modelValue", target.value);

  // Auto-resize functionality
  target.style.height = "auto";
  target.style.height = target.scrollHeight + "px";
};

const handleFocus = () => {
  if (!props.readonly) {
    emit("focus");
  }
};

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.altKey) {
    e.preventDefault();
  }
};

onMounted(() => {
  // Set initial height
  if (textareaRef.value) {
    textareaRef.value.style.height = "auto";
    textareaRef.value.style.height = textareaRef.value.scrollHeight + "px";
  }
});
</script>

<template>
  <textarea
    ref="textareaRef"
    :value="modelValue"
    :data-lyrics-input="dataLyricsInput"
    :style="verseStyles"
    :readonly="readonly"
    :placeholder="placeholder"
    rows="1"
    class="font-mono text-sm focus:outline-none focus:ring-0 focus:bg-base-content/15 rounded-sm px-1 resize-none overflow-hidden bg-size-content pb-0"
    style="field-sizing: content"
    @input="updateValue"
    @focus="handleFocus"
    @keydown="handleKeydown"
  />
</template>
