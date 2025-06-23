<script setup lang="ts">
import { average, selectMostContrasting } from "@/utils/color-utils";
import { Palette, X } from "lucide-vue-next";
import { computed } from "vue";

type Props = {
  selectedColors: string[];
  availableColors: { key: string; value: string }[];
  multiple?: boolean;
  disabled?: boolean;
  btnClass?: string;
  title?: string;
};

type Emits = {
  (e: "update:selectedColors", colors: string[]): void;
};

const props = withDefaults(defineProps<Props>(), {
  multiple: false,
  disabled: false,
  btnClass: "btn-sm",
  title: undefined
});

const emit = defineEmits<Emits>();

const buttonStyle = computed(() => {
  if (props.selectedColors.length === 0) {
    return {};
  }

  if (props.selectedColors.length === 1) {
    const colorValue = props.availableColors.find((c) => c.key === props.selectedColors[0])?.value;
    return {
      backgroundColor: colorValue,
      color: colorValue ? selectMostContrasting(colorValue, ["#ffffff", "#000000"]) : undefined
    };
  }

  // Multiple colors - create gradient
  const colors = props.selectedColors
    .map((key) => props.availableColors.find((c) => c.key === key)?.value)
    .filter(Boolean) as string[];

  return {
    background: `linear-gradient(135deg, ${colors.join(", ")})`,
    color: selectMostContrasting(average(colors), ["#ffffff", "#000000"])
  };
});

const buttonContent = computed(() => {
  if (props.selectedColors.length === 0) {
    return undefined;
  } else if (props.selectedColors.length === 1) {
    return props.selectedColors[0];
  } else {
    return props.selectedColors.length.toString();
  }
});

const toggleColor = (colorKey: string, event?: MouseEvent) => {
  if (props.disabled) return;

  // Check for Cmd (Mac) or Ctrl (Windows/Linux) key
  const isModifierPressed = event && (event.metaKey || event.ctrlKey);

  if (props.multiple) {
    // If modifier key is pressed, make this the only selected color
    if (isModifierPressed) {
      emit("update:selectedColors", [colorKey]);
      return;
    }

    const currentColors = [...props.selectedColors];
    const index = currentColors.indexOf(colorKey);

    if (index >= 0) {
      currentColors.splice(index, 1);
    } else {
      currentColors.push(colorKey);
    }

    emit("update:selectedColors", currentColors);
  } else {
    if (props.selectedColors.includes(colorKey)) {
      emit("update:selectedColors", []);
    } else {
      emit("update:selectedColors", [colorKey]);
    }
  }
};

const clearColors = () => {
  if (props.disabled) return;
  emit("update:selectedColors", []);
};

const getColorStyle = (colorKey: string) => {
  const colorValue = props.availableColors.find((c) => c.key === colorKey)?.value;
  return {
    backgroundColor: colorValue,
    color: colorValue ? selectMostContrasting(colorValue, ["#ffffff", "#000000"]) : undefined
  };
};

const isColorSelected = (colorKey: string) => {
  return props.selectedColors.includes(colorKey);
};
</script>

<template>
  <div class="dropdown" :title="props.title">
    <div
      :style="buttonStyle"
      tabindex="0"
      role="button"
      class="btn btn-square text-xs font-medium shadow-xs"
      :class="[btnClass, { 'btn-disabled': disabled }]"
    >
      <span v-if="buttonContent">{{ buttonContent }}</span>
      <Palette v-else class="size-3" />
    </div>
    <div
      v-if="!disabled"
      tabindex="0"
      class="dropdown-content menu bg-base-100 rounded-box border-base-content/10 z-50 min-w-max border p-2 shadow-lg"
    >
      <div class="flex flex-col gap-1">
        <div v-if="title" class="p-1 text-xs">
          {{ title }}
        </div>
        <div class="mb-2 grid grid-cols-4 gap-2 px-1">
          <button
            v-for="color in availableColors"
            :key="color.key"
            type="button"
            class="rounded-field h-6 w-6 flex-shrink-0 cursor-pointer border-2 text-xs font-medium opacity-80 shadow-xs transition-opacity duration-200 hover:opacity-100"
            :class="{
              'border-base-content opacity-100': isColorSelected(color.key),
              'border-transparent': !isColorSelected(color.key)
            }"
            :style="getColorStyle(color.key)"
            @click="toggleColor(color.key, $event)"
          >
            {{ color.key }}
          </button>
        </div>
        <button
          v-if="selectedColors.length > 0"
          type="button"
          class="btn btn-xs btn-ghost w-full"
          @click="clearColors"
        >
          <X class="size-3" />
          Limpiar
        </button>
      </div>
    </div>
  </div>
</template>
