<script setup lang="ts">
import { Check } from "lucide-vue-next";
import { computed, onMounted, onUnmounted, ref } from "vue";

const hideDelay = 400;

const firstTime = ref<number | null>(null);
const secondTime = ref<number | null>(null);

const copiedFirstTime = ref<number | null>(null);
const copiedSecondTime = ref<number | null>(null);

const isVisible = ref(false);

const wasCopied = computed(() => {
  return copiedFirstTime.value !== null;
});

const props = defineProps<{
  currentTime: number;
}>();

const copyTimeToClipboard = async () => {
  if (firstTime.value !== null) {
    if (secondTime.value !== null) {
      await navigator.clipboard.writeText(
        `"startTime": ${firstTime.value.toFixed(2)}, "endTime": ${secondTime.value.toFixed(2)},`
      );
    } else {
      await navigator.clipboard.writeText(`"startTime": ${firstTime.value.toFixed(2)},`);
    }
    copiedFirstTime.value = firstTime.value;
    copiedSecondTime.value = secondTime.value;
    firstTime.value = null;
    secondTime.value = null;

    setTimeout(() => {
      isVisible.value = false;
    }, hideDelay);
    setTimeout(() => {
      copiedFirstTime.value = null;
      copiedSecondTime.value = null;
    }, hideDelay + 300);
  }
};

const keydownHandler = (event: KeyboardEvent) => {
  if (event.key === ".") {
    if (firstTime.value === null) {
      isVisible.value = true;
      firstTime.value = props.currentTime;
    } else {
      secondTime.value = props.currentTime;
      copyTimeToClipboard();
    }
  } else if (event.key === ",") {
    copyTimeToClipboard();
  } else if (event.key === "Escape") {
    firstTime.value = null;
    secondTime.value = null;
  }
};

onMounted(() => {
  window.addEventListener("keydown", keydownHandler);
});

onUnmounted(() => {
  window.removeEventListener("keydown", keydownHandler);
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
      <div class="flex items-center gap-1.5">
        <span class="text-base-content/80" v-if="firstTime !== null || copiedFirstTime !== null">{{
          firstTime !== null ? firstTime.toFixed(2) : copiedFirstTime!.toFixed(2)
        }}</span>
        <span class="text-base-content/50" v-if="secondTime !== null || copiedSecondTime !== null"
          >-</span
        >
        <span
          class="text-base-content/80"
          v-if="secondTime !== null || copiedSecondTime !== null"
          >{{ secondTime !== null ? secondTime.toFixed(2) : copiedSecondTime!.toFixed(2) }}</span
        >
      </div>
      <Check
        v-if="wasCopied"
        class="text-success transition-all duration-300 w-4 h-4"
        :class="{ 'opacity-100': wasCopied, 'opacity-0': !wasCopied }"
      />
    </div>
  </div>
</template>
