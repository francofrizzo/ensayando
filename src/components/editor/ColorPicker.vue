<script setup lang="ts">
import { average, selectMostContrasting } from "@/utils/color-utils";
import { Palette, X } from "lucide-vue-next";
import { computed } from "vue";

interface Props {
  selectedColors: string[];
  availableColors: { key: string; value: string }[];
  multiple?: boolean;
  disabled?: boolean;
  btnClass?: string;
  title?: string;
}

interface Emits {
  (e: "update:selectedColors", colors: string[]): void;
}

const props = withDefaults(defineProps<Props>(), {
  multiple: false,
  disabled: false,
  btnClass: "btn-sm"
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
  <div class="dropdown" :title="title">
    <div
      :style="buttonStyle"
      tabindex="0"
      role="button"
      class="btn btn-square shadow-xs text-xs font-medium"
      :class="[btnClass, { 'btn-disabled': disabled }]"
    >
      <span v-if="buttonContent">{{ buttonContent }}</span>
      <Palette v-else class="size-3" />
    </div>
    <div
      v-if="!disabled"
      tabindex="0"
      class="dropdown-content menu bg-base-100 rounded-box min-w-max z-50 p-2 shadow-lg border border-base-content/10"
    >
      <div class="flex flex-col gap-1">
        <div v-if="title" class="text-xs p-1">
          {{ title }}
        </div>
        <div class="grid grid-cols-4 gap-2 mb-2 px-1">
          <button
            v-for="color in availableColors"
            :key="color.key"
            type="button"
            class="w-6 h-6 shadow-xs rounded-field text-xs font-medium opacity-80 hover:opacity-100 transition-opacity duration-200 cursor-pointer flex-shrink-0 border-2"
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
