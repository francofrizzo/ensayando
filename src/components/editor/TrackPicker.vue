<script setup lang="ts">
import type { AudioTrack } from "@/data/types";
import { selectMostContrasting } from "@/utils/color-utils";
import { MicVocal, X } from "lucide-vue-next";
import { computed } from "vue";

interface Props {
  selectedTrackIds: number[];
  availableTracks: AudioTrack[];
  availableColors: { key: string; value: string }[];
  multiple?: boolean;
  disabled?: boolean;
  btnClass?: string;
}

interface Emits {
  (e: "update:selectedTrackIds", trackIds: number[]): void;
}

const props = withDefaults(defineProps<Props>(), {
  multiple: false,
  disabled: false,
  btnClass: "btn-sm"
});

const emit = defineEmits<Emits>();

const toggleTrack = (trackId: number, event?: MouseEvent) => {
  if (props.disabled) return;

  // Check for Cmd (Mac) or Ctrl (Windows/Linux) key
  const isModifierPressed = event && (event.metaKey || event.ctrlKey);

  if (props.multiple) {
    // If modifier key is pressed, make this the only selected track
    if (isModifierPressed) {
      emit("update:selectedTrackIds", [trackId]);
      return;
    }

    const currentTrackIds = [...props.selectedTrackIds];
    const index = currentTrackIds.indexOf(trackId);

    if (index >= 0) {
      currentTrackIds.splice(index, 1);
    } else {
      currentTrackIds.push(trackId);
    }

    emit("update:selectedTrackIds", currentTrackIds);
  } else {
    if (props.selectedTrackIds.includes(trackId)) {
      emit("update:selectedTrackIds", []);
    } else {
      emit("update:selectedTrackIds", [trackId]);
    }
  }
};

const clearTracks = () => {
  if (props.disabled) return;
  emit("update:selectedTrackIds", []);
};

const isTrackSelected = (trackId: number) => {
  return props.selectedTrackIds.includes(trackId);
};

const sortedTracks = computed(() => {
  return [...props.availableTracks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
});

const getTrackButtonStyle = (track: AudioTrack, isSelected: boolean) => {
  if (!isSelected || !track.color_key) return {};

  return {
    backgroundColor: track.color_key,
    borderColor: track.color_key
    // color: selectMostContrasting(track.color_key, ["white", "black"])
  };
};

const getColorStyle = (colorKey: string) => {
  const colorValue = props.availableColors.find((c) => c.key === colorKey)?.value;
  return {
    backgroundColor: colorValue,
    color: colorValue ? selectMostContrasting(colorValue, ["#ffffff", "#000000"]) : undefined
  };
};
</script>

<template>
  <div class="dropdown dropdown-hover">
    <div
      tabindex="0"
      role="button"
      class="btn btn-square btn-ghost"
      :class="[
        btnClass,
        {
          'btn-disabled': disabled
        }
      ]"
    >
      <MicVocal class="size-3" />
    </div>
    <div
      v-if="!disabled"
      tabindex="0"
      class="dropdown-content menu bg-base-100 rounded-box z-50 w-64 p-2 shadow-lg border border-base-content/10"
    >
      <div v-if="sortedTracks.length === 0" class="text-xs text-base-content/50 px-2 py-1">
        No hay pistas disponibles
      </div>

      <div v-else class="flex flex-col gap-1">
        <div class="text-xs p-1">Pistas de audio del verso</div>
        <button
          v-for="track in sortedTracks"
          :key="track.id"
          class="btn btn-xs justify-start gap-2 transition-all duration-200"
          :class="{
            'btn-ghost': !isTrackSelected(track.id),
            'shadow-sm': isTrackSelected(track.id)
          }"
          :style="getTrackButtonStyle(track, isTrackSelected(track.id))"
          @click="toggleTrack(track.id, $event)"
        >
          <div class="size-3 rounded-full" :style="getColorStyle(track.color_key)"></div>
          <span class="truncate font-medium">{{ track.title }}</span>
        </button>

        <button
          v-if="multiple && selectedTrackIds.length > 0"
          class="btn btn-xs btn-ghost text-base-content/70 hover:bg-base-200"
          @click="clearTracks"
        >
          <X class="size-3" />
          Limpiar
        </button>
      </div>
    </div>
  </div>
</template>
