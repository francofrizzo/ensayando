<script setup lang="ts">
import { Check } from "lucide-vue-next";
import { onMounted, onUnmounted, ref } from "vue";

const hideDelay = 1000;

const isVisible = ref(false);
const wasCopied = ref(false);
const copiedTime = ref(0);
const copiedType = ref<"start_time" | "end_time">("start_time");

// Store timeout references to clear them when needed
const hideTimeout = ref<ReturnType<typeof setTimeout> | null>(null);
const resetCopiedTimeout = ref<ReturnType<typeof setTimeout> | null>(null);

const props = defineProps<{
  currentTime: number;
}>();

const copyTimeToClipboard = async (type: "start_time" | "end_time") => {
  // Clear any existing timeouts
  if (hideTimeout.value) {
    clearTimeout(hideTimeout.value);
  }
  if (resetCopiedTimeout.value) {
    clearTimeout(resetCopiedTimeout.value);
  }

  copiedTime.value = props.currentTime;
  copiedType.value = type;
  const jsonValue = `"${type}": ${props.currentTime.toFixed(2)},`;
  await navigator.clipboard.writeText(jsonValue);
  wasCopied.value = true;

  hideTimeout.value = setTimeout(() => {
    isVisible.value = false;
  }, hideDelay);

  resetCopiedTimeout.value = setTimeout(() => {
    wasCopied.value = false;
  }, hideDelay + 300);
};

const keydownHandler = (event: KeyboardEvent) => {
  if (event.metaKey) {
    if (event.key === ",") {
      event.preventDefault();
      isVisible.value = true;
      copyTimeToClipboard("start_time");
    } else if (event.key === ".") {
      event.preventDefault();
      isVisible.value = true;
      copyTimeToClipboard("end_time");
    }
  }
};

onMounted(() => {
  window.addEventListener("keydown", keydownHandler, true);
});

onUnmounted(() => {
  window.removeEventListener("keydown", keydownHandler, true);
});
</script>

<template>
  <div
    class="bg-base-300 border border-base-200 rounded-box px-2 py-0.5 transition-all duration-300 text-sm"
    :class="{
      'opacity-0': !isVisible,
      'scale-110': wasCopied
    }"
  >
    <div class="flex items-center gap-2">
      <span class="text-base-content/80 font-mono">
        "{{ copiedType }}": {{ copiedTime.toFixed(2) }}
      </span>
      <Check
        v-if="wasCopied"
        class="text-success transition-all duration-300 w-4 h-4"
        :class="{ 'opacity-100': wasCopied, 'opacity-0': !wasCopied }"
      />
    </div>
  </div>
</template>
