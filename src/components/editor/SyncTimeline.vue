<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";

import { IconWarning } from "@/components/ui/icons";

import {
  applyRegionDrag,
  assignLanes,
  type DragMode,
  followScroll,
  formatClock,
  pxPerSecond,
  pxToTime,
  type Region,
  rulerTicks,
  type SyncZoom,
  tickStep
} from "@/utils/syncTimeline";

export type TimelineRegion = {
  index: number;
  start: number;
  end: number;
  label: string;
  /** Lyric ink of the verse's first track (label and selected outline). */
  ink: string;
  /** Wave color of that track (fill and border). */
  wave: string;
  /** Starts before an earlier verse: shown with a warning outline. */
  outOfOrder?: boolean;
};

export type TimelineTrack = {
  id: number;
  title: string;
  color: string;
  peaks: number[] | null;
  peaksDuration: number;
};

const props = defineProps<{
  regions: TimelineRegion[];
  tracks: TimelineTrack[];
  duration: number;
  currentTime: number;
  playing: boolean;
  zoom: SyncZoom;
  selectedIndex: number | null;
}>();

const emit = defineEmits<{
  seek: [time: number];
  select: [index: number | null];
  change: [index: number, region: Region];
  "play-region": [index: number];
}>();

const selectedIndex = computed(() => props.selectedIndex);

const ROW_HEIGHT = 26;
const ROW_GAP = 5;

const scroller = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const viewportWidth = ref(0);
const scrollLeft = ref(0);

const pps = computed(() => pxPerSecond(props.zoom, props.duration, viewportWidth.value));
const contentWidth = computed(() =>
  Math.max(viewportWidth.value, Math.ceil(props.duration * pps.value))
);
const ticks = computed(() => rulerTicks(props.duration, pps.value));
const majorEvery = computed(() => (tickStep(pps.value) < 5 ? 5 : tickStep(pps.value)));
const wavesHeight = computed(() =>
  Math.max(ROW_HEIGHT, props.tracks.length * (ROW_HEIGHT + ROW_GAP) - ROW_GAP)
);

// ---------- dragging ----------
const drag = reactive<{
  index: number | null;
  mode: DragMode;
  originX: number;
  origin: Region;
  preview: Region | null;
  moved: boolean;
}>({ index: null, mode: "move", originX: 0, origin: { start: 0, end: 0 }, preview: null, moved: false });

// Overlapping regions stack in lanes so every label stays readable.
const LANE_HEIGHT = 24;
const LANE_GAP = 3;
const shownRegion = (region: TimelineRegion) =>
  drag.index === region.index && drag.preview ? drag.preview : region;
const lanes = computed(() => assignLanes(props.regions.map(shownRegion)));
const laneCount = computed(() => Math.max(1, ...lanes.value.map((lane) => lane + 1)));
const regionsHeight = computed(() =>
  laneCount.value === 1 ? 54 : 8 + laneCount.value * LANE_HEIGHT + (laneCount.value - 1) * LANE_GAP
);

const regionBox = (region: TimelineRegion, position: number) => {
  const shown = shownRegion(region);
  const box: Record<string, string> = {
    left: `${shown.start * pps.value}px`,
    width: `${Math.max(6, (shown.end - shown.start) * pps.value)}px`
  };
  if (laneCount.value > 1) {
    box.top = `${4 + (lanes.value[position] ?? 0) * (LANE_HEIGHT + LANE_GAP)}px`;
    box.height = `${LANE_HEIGHT}px`;
    box.bottom = "auto";
  }
  return box;
};

const regionOutline = (region: TimelineRegion) => {
  if (selectedIndex.value === region.index) return `inset 0 0 0 2px ${region.ink}`;
  if (region.outOfOrder) return "inset 0 0 0 1.5px var(--color-warning)";
  return `inset 0 0 0 1px color-mix(in oklch, ${region.wave} 60%, transparent)`;
};

const onRegionPointerDown = (event: PointerEvent, region: TimelineRegion, mode: DragMode) => {
  if (event.button !== 0) return;
  event.stopPropagation();
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  drag.index = region.index;
  drag.mode = mode;
  drag.originX = event.clientX;
  drag.origin = { start: region.start, end: region.end };
  drag.preview = null;
  drag.moved = false;
  emit("select", region.index);
};

const onRegionPointerMove = (event: PointerEvent) => {
  if (drag.index === null || pps.value <= 0) return;
  const dx = event.clientX - drag.originX;
  if (!drag.moved && Math.abs(dx) < 3) return;
  drag.moved = true;
  drag.preview = applyRegionDrag(drag.origin, drag.mode, pxToTime(dx, pps.value), props.duration);
};

const onRegionPointerUp = () => {
  if (drag.index !== null && drag.moved && drag.preview) {
    emit("change", drag.index, drag.preview);
  }
  drag.index = null;
  drag.preview = null;
};

// ---------- seeking ----------
const seekFromEvent = (event: MouseEvent) => {
  if (!scroller.value || pps.value <= 0) return;
  const rect = scroller.value.getBoundingClientRect();
  const x = event.clientX - rect.left + scroller.value.scrollLeft;
  emit("seek", Math.min(props.duration, Math.max(0, pxToTime(x, pps.value))));
};

const onBackgroundClick = (event: MouseEvent) => {
  emit("select", null);
  seekFromEvent(event);
};

// ---------- follow playback ----------
watch(
  () => props.currentTime,
  (time) => {
    if (!props.playing || !scroller.value || drag.index !== null) return;
    const next = followScroll(
      time * pps.value,
      scroller.value.scrollLeft,
      viewportWidth.value,
      contentWidth.value
    );
    if (next !== scroller.value.scrollLeft) scroller.value.scrollLeft = next;
  }
);

// Changing zoom keeps the playhead in view.
watch(
  () => props.zoom,
  () => {
    requestAnimationFrame(() => {
      if (!scroller.value) return;
      scroller.value.scrollLeft = Math.max(0, props.currentTime * pps.value - viewportWidth.value * 0.3);
      scheduleDraw();
    });
  }
);

// ---------- waves (one canvas the size of the viewport, redrawn on scroll) ----------
let frame = 0;
const scheduleDraw = () => {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(draw);
};

const bucketMax = (peaks: number[], from: number, to: number) => {
  let max = 0;
  const a = Math.max(0, Math.floor(from));
  const b = Math.min(peaks.length, Math.max(a + 1, Math.ceil(to)));
  for (let i = a; i < b; i++) if (peaks[i]! > max) max = peaks[i]!;
  return max;
};

function draw() {
  const el = canvas.value;
  if (!el || viewportWidth.value <= 0) return;
  const dpr = window.devicePixelRatio || 1;
  const width = viewportWidth.value;
  const height = wavesHeight.value;
  if (el.width !== Math.round(width * dpr) || el.height !== Math.round(height * dpr)) {
    el.width = Math.round(width * dpr);
    el.height = Math.round(height * dpr);
  }
  const ctx = el.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (pps.value <= 0) return;

  const step = 3; // 2 px bar + 1 px gap
  const t0 = scrollLeft.value / pps.value;
  const playheadX = (props.currentTime - t0) * pps.value;

  props.tracks.forEach((track, row) => {
    const y = row * (ROW_HEIGHT + ROW_GAP);
    const mid = y + ROW_HEIGHT / 2;
    ctx.fillStyle = track.color;
    const peaks = track.peaks;
    if (!peaks || peaks.length === 0 || !(track.peaksDuration > 0)) {
      ctx.globalAlpha = 0.35;
      ctx.fillRect(0, mid - 0.5, width, 1);
      return;
    }
    const maxPeak = peaks.reduce((m, v) => (v > m ? v : m), 0) || 1;
    const perSecond = peaks.length / track.peaksDuration;
    for (let x = 0; x < width; x += step) {
      const from = (t0 + x / pps.value) * perSecond;
      const to = (t0 + (x + step) / pps.value) * perSecond;
      if (from >= peaks.length) break;
      const value = bucketMax(peaks, from, to) / maxPeak;
      const barHeight = Math.max(1.5, value * ROW_HEIGHT * 0.92);
      ctx.globalAlpha = x < playheadX ? 1 : 0.32;
      ctx.fillRect(x, mid - barHeight / 2, 2, barHeight);
    }
  });
  ctx.globalAlpha = 1;
}

watch(
  () => [props.tracks, props.currentTime, pps.value, wavesHeight.value],
  scheduleDraw,
  { deep: false }
);

const onScroll = () => {
  if (!scroller.value) return;
  scrollLeft.value = scroller.value.scrollLeft;
  scheduleDraw();
};

let observer: ResizeObserver | null = null;
onMounted(() => {
  if (!scroller.value) return;
  viewportWidth.value = scroller.value.clientWidth;
  observer = new ResizeObserver(() => {
    if (!scroller.value) return;
    viewportWidth.value = scroller.value.clientWidth;
    scheduleDraw();
  });
  observer.observe(scroller.value);
  scheduleDraw();
});

onBeforeUnmount(() => {
  observer?.disconnect();
  cancelAnimationFrame(frame);
});

defineExpose({ pps });
</script>

<template>
  <div class="flex min-h-0 min-w-0 flex-col gap-1.5" data-testid="sync-timeline">
    <div
      ref="scroller"
      class="relative min-w-0 overflow-x-auto overflow-y-hidden"
      style="scrollbar-width: thin"
      @scroll.passive="onScroll"
    >
      <div class="relative" :style="{ width: `${contentWidth}px` }">
        <!-- Ruler -->
        <div
          class="border-base-content/10 relative h-[18px] cursor-pointer border-b"
          @click="onBackgroundClick"
        >
          <template v-for="tick in ticks" :key="tick">
            <i
              class="bg-base-content/25 absolute bottom-0 w-px"
              :class="tick % majorEvery === 0 ? 'h-[9px]' : 'h-[5px]'"
              :style="{ left: `${tick * pps}px` }"
            />
            <span
              v-if="tick % majorEvery === 0 || majorEvery === tickStep(pps)"
              class="text-base-content/45 absolute top-0 font-mono text-[10.5px] leading-none"
              :class="
                tick === 0
                  ? 'translate-x-1'
                  : tick * pps > contentWidth - 24
                    ? '-translate-x-full'
                    : '-translate-x-1/2'
              "
              :style="{ left: `${tick * pps}px` }"
              >{{ formatClock(tick) }}</span
            >
          </template>
        </div>

        <!-- Verse regions -->
        <div class="relative" :style="{ height: `${regionsHeight}px` }" @click="onBackgroundClick">
          <div
            v-for="(region, position) in regions"
            :key="region.index"
            class="group absolute top-1 bottom-1 flex cursor-grab touch-none items-center gap-1 overflow-hidden rounded-[9px] px-2 font-lyrics text-[11px] leading-tight font-semibold tracking-[0.02em] whitespace-nowrap uppercase select-none active:cursor-grabbing"
            :class="[
              { 'z-10': selectedIndex === region.index },
              laneCount > 1 ? 'py-0' : 'items-start py-1.5'
            ]"
            :style="{
              ...regionBox(region, position),
              color: region.ink,
              background: `color-mix(in oklch, ${region.wave} ${selectedIndex === region.index ? 34 : 22}%, transparent)`,
              boxShadow: regionOutline(region)
            }"
            :title="region.outOfOrder ? `${region.label} · Empieza antes que un verso anterior` : region.label"
            data-testid="sync-region"
            @pointerdown="(e) => onRegionPointerDown(e, region, 'move')"
            @pointermove="onRegionPointerMove"
            @pointerup="onRegionPointerUp"
            @pointercancel="onRegionPointerUp"
            @click.stop
            @dblclick.stop="emit('play-region', region.index)"
          >
            <IconWarning v-if="region.outOfOrder" class="text-warning size-3 shrink-0" aria-hidden="true" />
            <span class="block min-w-0 overflow-hidden text-ellipsis">{{ region.label }}</span>
            <span
              class="absolute inset-y-0 left-0 w-2 cursor-ew-resize"
              aria-hidden="true"
              @pointerdown="(e) => onRegionPointerDown(e, region, 'start')"
            >
              <span
                v-if="selectedIndex === region.index"
                class="absolute top-1/2 left-0 h-[22px] w-[5px] -translate-y-1/2 rounded-full"
                :style="{ background: region.ink }"
              />
            </span>
            <span
              class="absolute inset-y-0 right-0 w-2 cursor-ew-resize"
              aria-hidden="true"
              @pointerdown="(e) => onRegionPointerDown(e, region, 'end')"
            >
              <span
                v-if="selectedIndex === region.index"
                class="absolute top-1/2 right-0 h-[22px] w-[5px] -translate-y-1/2 rounded-full"
                :style="{ background: region.ink }"
              />
            </span>
          </div>
        </div>

        <!-- Per-track waves: one canvas pinned to the viewport -->
        <div class="relative cursor-pointer" :style="{ height: `${wavesHeight}px` }" @click="onBackgroundClick">
          <canvas
            ref="canvas"
            class="sticky left-0 block"
            :style="{ width: `${viewportWidth}px`, height: `${wavesHeight}px` }"
            aria-hidden="true"
          />
        </div>

        <!-- Playhead -->
        <div
          class="bg-base-content pointer-events-none absolute top-0 bottom-0 z-20 w-0.5 rounded-full"
          :style="{ left: `${currentTime * pps - 1}px` }"
          data-testid="sync-playhead"
        >
          <span
            class="border-t-base-content absolute -top-px left-1/2 -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent"
          />
        </div>
      </div>
    </div>
    <div class="text-base-content/45 flex gap-4 px-0.5 text-[11px]">
      <span v-for="track in tracks" :key="track.id" class="flex items-center gap-1.5">
        <span class="size-2 rounded-full" :style="{ background: track.color }" />{{ track.title }}
      </span>
    </div>
  </div>
</template>
