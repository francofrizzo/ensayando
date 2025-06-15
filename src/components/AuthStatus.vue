<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";
import { LogIn, LogOut, User } from "lucide-vue-next";
import { ref } from "vue";
import { toast } from "vue-sonner";
import LoginModal from "./LoginModal.vue";

const authStore = useAuthStore();
const showLoginModal = ref(false);

const handleLogout = async () => {
  try {
    await authStore.signOut();
  } catch (error) {
    toast.error(`Error al cerrar sesión: ${error}`);
  }
};
</script>

<template>
  <div class="flex items-center gap-2 text-xs">
    <template v-if="authStore.isAuthenticated()">
      <div class="items-center gap-2 hidden md:flex">
        <User class="size-3.5" />
        <span>{{ authStore.user?.email }}</span>
      </div>
      <button class="btn btn-xs btn-square btn-ghost" @click="handleLogout" title="Cerrar sesión">
        <LogOut class="size-3.5" />
        <span class="sr-only">Salir</span>
      </button>
    </template>

    <template v-else>
      <button class="btn btn-xs btn-soft" @click="showLoginModal = true">
        <LogIn class="size-3.5" />
        <span class="hidden md:block">Iniciar sesión</span>
      </button>
    </template>

    <LoginModal v-if="showLoginModal" @close="showLoginModal = false" />
  </div>
</template>
