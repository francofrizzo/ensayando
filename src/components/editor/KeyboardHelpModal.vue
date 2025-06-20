<script setup lang="ts">
import { X } from "lucide-vue-next";

defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const isMac = navigator.platform.toLowerCase().includes("mac");
const modKey = isMac ? "⌘" : "Ctrl";
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="emit('close')"></div>

    <div
      class="relative bg-base-100/60 backdrop-blur-sm rounded-lg shadow-xl border border-base-300 max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto"
    >
      <div
        class="sticky top-0 bg-base-100 border-b border-base-200 px-6 py-4 flex items-center justify-between"
      >
        <h2 class="text-xl font-semibold">Atajos de teclado</h2>
        <button class="btn btn-sm btn-circle btn-ghost" @click="emit('close')">
          <X class="size-4" />
        </button>
      </div>

      <div class="p-6 space-y-6">
        <div>
          <h3 class="font-medium uppercase tracking-wide mb-3 text-primary">Navegación</h3>
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <span>Navegar entre líneas</span>
              <div class="flex gap-1">
                <kbd class="kbd kbd-sm">↑</kbd>
                <kbd class="kbd kbd-sm">↓</kbd>
              </div>
            </div>
            <div class="flex justify-between items-center">
              <span>Moverse dentro del texto</span>
              <div class="flex gap-1">
                <kbd class="kbd kbd-sm">←</kbd>
                <kbd class="kbd kbd-sm">→</kbd>
              </div>
            </div>
            <div class="flex justify-between items-center">
              <span>Campo siguiente/anterior</span>
              <div class="flex gap-1 items-center text-sm">
                <kbd class="kbd kbd-sm">Tab</kbd>
                <span class="text-base-content/60">/</span>
                <kbd class="kbd kbd-sm">Shift</kbd>
                <span class="text-base-content/60">+</span>
                <kbd class="kbd kbd-sm">Tab</kbd>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 class="font-medium uppercase tracking-wide mb-3 text-primary">
            Operaciones de líneas
          </h3>
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <span>Insertar nueva línea después</span>
              <div class="flex gap-1 items-center text-sm">
                <kbd class="kbd kbd-sm">{{ modKey }}</kbd>
                <span class="text-base-content/60">+</span>
                <kbd class="kbd kbd-sm">Enter</kbd>
              </div>
            </div>
            <div class="flex justify-between items-center">
              <span>Insertar nueva línea antes</span>
              <div class="flex gap-1 items-center text-sm">
                <kbd class="kbd kbd-sm">{{ modKey }}</kbd>
                <span class="text-base-content/60">+</span>
                <kbd class="kbd kbd-sm">Shift</kbd>
                <span class="text-base-content/60">+</span>
                <kbd class="kbd kbd-sm">Enter</kbd>
              </div>
            </div>
            <div class="flex justify-between items-center">
              <span>Duplicar línea actual</span>
              <div class="flex gap-1 items-center text-sm">
                <kbd class="kbd kbd-sm">{{ modKey }}</kbd>
                <span class="text-base-content/60">+</span>
                <kbd class="kbd kbd-sm">D</kbd>
              </div>
            </div>
            <div class="flex justify-between items-center">
              <span>Eliminar línea actual</span>
              <div class="flex gap-1 items-center text-sm">
                <kbd class="kbd kbd-sm">{{ modKey }}</kbd>
                <span class="text-base-content/60">+</span>
                <kbd class="kbd kbd-sm">Backspace</kbd>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 class="font-medium uppercase tracking-wide mb-3 text-primary">
            Operaciones de columnas
          </h3>
          <div class="space-y-2">
            <div class="text-sm text-base-content/70 mb-2">
              <em>Disponibles solo en versos con múltiples columnas</em>
            </div>
            <div class="flex justify-between items-center">
              <span>Insertar columna a la derecha</span>
              <div class="flex gap-1 items-center text-sm">
                <kbd class="kbd kbd-sm">{{ modKey }}</kbd>
                <span class="text-base-content/60">+</span>
                <kbd class="kbd kbd-sm">]</kbd>
              </div>
            </div>
            <div class="flex justify-between items-center">
              <span>Insertar columna a la izquierda</span>
              <div class="flex gap-1 items-center text-sm">
                <kbd class="kbd kbd-sm">{{ modKey }}</kbd>
                <span class="text-base-content/60">+</span>
                <kbd class="kbd kbd-sm">[</kbd>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 class="font-medium uppercase tracking-wide mb-3 text-primary">
            Operaciones de estrofas
          </h3>
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <span>Insertar nueva estrofa</span>
              <div class="flex gap-1 items-center text-sm">
                <kbd class="kbd kbd-sm">{{ modKey }}</kbd>
                <span class="text-base-content/60">+</span>
                <kbd class="kbd kbd-sm">Shift</kbd>
                <span class="text-base-content/60">+</span>
                <kbd class="kbd kbd-sm">N</kbd>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 class="font-medium uppercase tracking-wide mb-3 text-primary">Acciones rápidas</h3>
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <span>Guardar cambios</span>
              <div class="flex gap-1 items-center text-sm">
                <kbd class="kbd kbd-sm">{{ modKey }}</kbd>
                <span class="text-base-content/60">+</span>
                <kbd class="kbd kbd-sm">S</kbd>
              </div>
            </div>
            <div class="flex justify-between items-center">
              <span>Mostrar/ocultar esta ayuda</span>
              <div class="flex gap-1 items-center text-sm">
                <kbd class="kbd kbd-sm">Shift</kbd>
                <span class="text-base-content/60">+</span>
                <kbd class="kbd kbd-sm">?</kbd>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
