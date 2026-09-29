<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";

import { IconLogIn, IconLogOut } from "@/components/ui/icons";
import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
const router = useRouter();

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
    <ul tabindex="0" class="dropdown-content menu glass-3 rounded-box z-50 mt-2 w-60 p-1.5">
      <li class="menu-title truncate normal-case">{{ displayName }}</li>
      <li>
        <button @click="signOut">
          <IconLogOut class="size-[17px] opacity-70" />
          Cerrar sesión
        </button>
      </li>
    </ul>
  </div>
</template>
