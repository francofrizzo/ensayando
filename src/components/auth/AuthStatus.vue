<script setup lang="ts">
import { LogIn, LogOut, User } from "lucide-vue-next";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";

import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
const router = useRouter();

const handleLogout = async () => {
  try {
    await authStore.signOut();
    await router.replace({
      name: "login",
      query: { redirect: router.currentRoute.value.fullPath }
    });
  } catch (error) {
    toast.error(`Error al cerrar sesión: ${error}`);
  }
};
</script>

<template>
  <div class="flex min-w-0 items-center justify-between gap-2 text-xs">
    <template v-if="authStore.isAuthenticated">
      <div class="flex items-center gap-2 truncate text-ellipsis">
        <User class="size-4 shrink-0" />
        <span>{{ authStore.username }}</span>
      </div>
      <button class="btn btn-circle btn-ghost btn-sm" title="Cerrar sesión" @click="handleLogout">
        <LogOut class="size-4" />
        <span class="sr-only">Cerrar sesión</span>
      </button>
    </template>

    <template v-else>
      <button class="btn btn-circle btn-ghost btn-sm" @click="router.push({ name: 'login' })">
        <LogIn class="size-4" />
        <span class="sr-only">Iniciar sesión</span>
      </button>
    </template>
  </div>
</template>
