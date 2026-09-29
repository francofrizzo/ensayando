<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";

import {
  IconLogIn,
  IconLogOut,
  IconThemeDark,
  IconThemeLight,
  IconThemeSystem
} from "@/components/ui/icons";
import { type ThemeMode, useTheme } from "@/composables/useTheme";
import { useAuthStore } from "@/stores/auth";

// The avatar's menu: who is signed in, the theme, and signing out. Every avatar
// in the app opens it.

const authStore = useAuthStore();
const router = useRouter();
const { mode: themeMode, setMode: setThemeMode } = useTheme();

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: typeof IconThemeSystem }[] = [
  { mode: "system", label: "Tema del sistema", icon: IconThemeSystem },
  { mode: "light", label: "Tema claro", icon: IconThemeLight },
  { mode: "dark", label: "Tema oscuro", icon: IconThemeDark }
];

const displayName = computed(() => {
  const name = authStore.username ?? "";
  return name.includes("@") ? name.split("@")[0]! : name;
});

const initials = computed(() => {
  const parts = displayName.value.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0]![0]! + parts[1]![0]! : displayName.value.slice(0, 2);
  return letters.toUpperCase() || "?";
});

const signOut = async () => {
  (document.activeElement as HTMLElement | null)?.blur();
  try {
    await authStore.signOut();
    await router.replace({
      name: "login",
      query: { redirect: router.currentRoute.value.fullPath }
    });
  } catch (error) {
    toast.error("No se pudo cerrar la sesión", { description: String(error) });
  }
};
</script>

<template>
  <button
    v-if="!authStore.isAuthenticated"
    class="btn btn-sm btn-ghost rounded-full"
    @click="router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })"
  >
    <IconLogIn class="size-4" />
    <span class="hidden sm:inline">Entrar</span>
  </button>
  <div v-else class="dropdown dropdown-end">
    <div
      tabindex="0"
      role="button"
      class="bg-collection-soft text-collection-ink grid size-[30px] cursor-pointer place-items-center rounded-full text-xs font-bold"
      :aria-label="`Cuenta de ${displayName}`"
    >
      {{ initials }}
    </div>
    <div tabindex="0" class="dropdown-content glass-3 rounded-box z-50 mt-2 w-60 p-1.5">
      <p class="text-base-content/60 truncate px-3 pt-2 pb-1 text-sm font-semibold">
        {{ displayName }}
      </p>
      <div class="join flex px-1.5 py-1" role="group" aria-label="Tema">
        <button
          v-for="option in THEME_OPTIONS"
          :key="option.mode"
          type="button"
          class="btn btn-sm join-item flex-1"
          :class="themeMode === option.mode ? 'btn-active' : 'btn-ghost'"
          :aria-label="option.label"
          :aria-pressed="themeMode === option.mode"
          :title="option.label"
          @click="setThemeMode(option.mode)"
        >
          <component :is="option.icon" class="size-4" />
        </button>
      </div>
      <ul class="menu w-full p-0 pt-1">
        <li>
          <button @click="signOut">
            <IconLogOut class="size-[17px] opacity-70" />
            Cerrar sesión
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
