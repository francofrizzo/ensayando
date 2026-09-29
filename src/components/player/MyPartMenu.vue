<script setup lang="ts">
import { computed, toRef } from "vue";

import { IconCheck, IconMyPart } from "@/components/ui/icons";
import { useCollectionPalette } from "@/composables/useCollectionPalette";
import type { MyPartState } from "@/composables/usePlayerState";
import type { AudioTrack, CollectionWithRole } from "@/data/types";

const props = defineProps<{
  collection: CollectionWithRole;
  tracks: AudioTrack[];
  part: MyPartState;
  compact?: boolean;
}>();

const emit = defineEmits<{
  "toggle-track": [trackId: number];
  "set-duck": [value: boolean];
  clear: [];
}>();

const { trackColor } = useCollectionPalette(toRef(props, "collection"));

const selected = computed(() => props.tracks.filter((t) => props.part.trackIds.includes(t.id)));
const label = computed(() =>
  selected.value.length === 0
    ? "Mi parte"
    : `Mi parte: ${selected.value.map((t) => t.title).join(", ")}`
);
</script>

<template>
  <div class="dropdown dropdown-end">
    <div
      tabindex="0"
      role="button"
      class="btn btn-sm bg-base-content/7 hover:bg-base-content/12 max-w-60 gap-2 rounded-full border-0 font-semibold shadow-none"
      :class="{ 'btn-square': props.compact }"
      :title="label"
      data-testid="my-part-button"
    >
      <span v-if="selected.length > 0" class="flex shrink-0">
        <span
          v-for="track in selected"
          :key="track.id"
          class="ring-base-100 -ml-1 size-2.5 rounded-full ring-2 first:ml-0"
          :style="{ background: trackColor(track.color_key, 'wave') }"
        />
      </span>
      <IconMyPart v-else class="size-4" />
      <span v-if="!props.compact" class="truncate">{{ label }}</span>
    </div>
    <div
      tabindex="0"
      class="dropdown-content glass-3 rounded-box z-50 mt-2 flex w-72 flex-col gap-0.5 p-1.5"
    >
      <label
        v-for="track in props.tracks"
        :key="track.id"
        class="hover:bg-base-content/6 flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm"
      >
        <input
          type="checkbox"
          class="sr-only"
          :checked="props.part.trackIds.includes(track.id)"
          @change="emit('toggle-track', track.id)"
        />
        <span
          class="grid size-[18px] shrink-0 place-items-center rounded-[5px] text-white"
          :style="
            props.part.trackIds.includes(track.id)
              ? { background: trackColor(track.color_key, 'fill') }
              : { boxShadow: 'inset 0 0 0 1.5px var(--color-base-content)', opacity: 0.35 }
          "
        >
          <IconCheck v-if="props.part.trackIds.includes(track.id)" class="size-3.5" />
        </span>
        <span
          class="size-2.5 shrink-0 rounded-full"
          :style="{ background: trackColor(track.color_key, 'wave') }"
        />
        <span class="truncate font-medium">{{ track.title }}</span>
      </label>
      <div class="bg-base-content/10 mx-1 my-1 h-px" />
      <label class="flex cursor-pointer items-center justify-between gap-3 px-2.5 py-2 text-sm">
        <span>Bajar el resto</span>
        <input
          type="checkbox"
          class="toggle toggle-primary toggle-sm"
          :checked="props.part.duckOthers"
          :disabled="props.part.trackIds.length === 0"
          @change="emit('set-duck', ($event.target as HTMLInputElement).checked)"
        />
      </label>
      <button
        v-if="props.part.trackIds.length > 0"
        class="btn btn-ghost btn-sm justify-start font-medium"
        @click="emit('clear')"
      >
        Deseleccionar todo
      </button>
    </div>
  </div>
</template>
