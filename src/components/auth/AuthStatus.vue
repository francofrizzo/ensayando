<script setup lang="ts">
import { LogIn, LogOut, User } from "lucide-vue-next";
import { ref } from "vue";
import { toast } from "vue-sonner";

import LoginModal from "@/components/auth/LoginModal.vue";
import { useAuthStore } from "@/stores/auth";

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
  <div class="flex items-center gap-2 text-xs min-w-0">
    <template v-if="authStore.isAuthenticated">
      <div class="items-center gap-2 flex truncate text-ellipsis">
        <User class="size-4 shrink-0" />
        <span>{{ authStore.user?.email }}</span>
      </div>
      <button class="btn btn-circle btn-ghost btn-sm" title="Cerrar sesión" @click="handleLogout">
        <LogOut class="size-4" />
        <span class="sr-only">Cerrar sesión</span>
      </button>
    </template>

    <template v-else>
      <button class="btn btn-circle btn-ghost btn-sm" @click="showLoginModal = true">
        <LogIn class="size-4" />
        <span class="sr-only">Iniciar sesión</span>
      </button>
    </template>

    <LoginModal v-if="showLoginModal" @close="showLoginModal = false" />
  </div>
</template>
