<script setup lang="ts">
import { computed } from "vue";

import { useCollectionPalette } from "@/composables/useCollectionPalette";
import { useRoomLightArtwork } from "@/composables/useRoomLightArtwork";
import type { Collection } from "@/data/types";
import { artworkPlaybackUrl } from "@/data/storage";
import { deriveColor } from "@/utils/palette";

// "Luz de sala": soft glows of the collection hue and its first two track hues
// behind the stage (design/fundamentos/materiales.html). The parent must be
// `relative isolate` so the light stays behind its content.
const props = defineProps<{
  collection?: Collection | null;
  playing?: boolean;
}>();

const { palette, resolvedTheme } = useCollectionPalette(computed(() => props.collection ?? null));

// With the collection's toggle on and a cover uploaded, the blurred cover replaces the glows.
const { useArtwork } = useRoomLightArtwork(computed(() => props.collection?.id));
const artworkUrl = computed(() =>
  useArtwork.value && props.collection ? artworkPlaybackUrl(props.collection) : ""
);
const artworkOpacity = computed(() => (resolvedTheme.value === "dark" ? 0.35 : 0.25));

// Subtle on purpose: 16 % in light, 24 % in dark.
const alpha = computed(() => (resolvedTheme.value === "dark" ? 0.24 : 0.16));

const background = computed(() => {
  const main = palette.value.main;
  const tracks = Object.values(palette.value.tracks);
  const [second, third] = [tracks[0] ?? main, tracks[1] ?? tracks[0] ?? main];
  const glow = (spec: typeof main, strength: number) =>
    deriveColor(spec, "fill", resolvedTheme.value, Number((alpha.value * strength).toFixed(3)));
  return [
    `radial-gradient(42% 38% at 18% 8%, ${glow(main, 1)}, transparent 72%)`,
    `radial-gradient(36% 34% at 88% 22%, ${glow(second, 0.75)}, transparent 72%)`,
    `radial-gradient(48% 40% at 62% 104%, ${glow(third, 0.6)}, transparent 72%)`
  ].join(", ");
});

// Fine grain so the gradients don't band.
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";
</script>

<template>
  <div class="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
    <img
      v-if="artworkUrl"
      data-testid="room-light-artwork"
      :src="artworkUrl"
      alt=""
      class="absolute -inset-[10%] size-[120%] max-w-none object-cover blur-[80px] saturate-[1.6]"
      :class="{ 'room-light-drift': props.playing }"
      :style="{ opacity: artworkOpacity }"
    />
    <div
      v-else
      data-testid="room-light"
      class="absolute -inset-[10%] transition-[background] duration-700"
      :class="{ 'room-light-drift': props.playing }"
      :style="{ backgroundImage: background }"
    />
    <div class="absolute inset-0 opacity-5 mix-blend-overlay" :style="{ backgroundImage: GRAIN }" />
  </div>
</template>
