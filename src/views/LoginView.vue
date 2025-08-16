<script setup lang="ts">
import { Key, LogIn, Mail, UserPlus } from "lucide-vue-next";
import { onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const email = ref("");
const password = ref("");
const isLoading = ref(false);
const error = ref("");
const isSignUp = ref(false);
const successMessage = ref("");

onMounted(() => {
  // no-op; form is inline
});

watch(
  () => authStore.isAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated) {
      const redirect = (route.query.redirect as string) || "/";
      router.replace(redirect);
    }
  },
  { immediate: true }
);

const handleSubmit = async () => {
  if (!email.value || !password.value) {
    error.value = "Por favor, completa todos los campos";
    return;
  }

  if (isSignUp.value && password.value.length < 6) {
    error.value = "La contraseña debe tener al menos 6 caracteres";
    return;
  }

  isLoading.value = true;
  error.value = "";
  successMessage.value = "";

  try {
    if (isSignUp.value) {
      const result = await authStore.signUp(email.value, password.value);
      if (result.user && !result.session) {
        successMessage.value = "¡Cuenta creada! Revisa tu email para confirmar tu cuenta.";
      } else {
        // Auto-login
        // watcher will redirect
      }
    } else {
      await authStore.signIn(email.value, password.value);
      // watcher will redirect
    }
  } catch (err: any) {
    error.value = err.message || `Error al ${isSignUp.value ? "registrarse" : "iniciar sesión"}`;
  } finally {
    isLoading.value = false;
  }
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === "Enter") {
    handleSubmit();
  }
};

const switchMode = (signUp: boolean) => {
  isSignUp.value = signUp;
  error.value = "";
  successMessage.value = "";
};
</script>

<template>
  <div class="bg-base-200 flex min-h-dvh items-center justify-center p-4">
    <div class="bg-base-100 text-base-content rounded-box w-full max-w-md p-6 shadow">
      <div class="flex items-center justify-between gap-6">
        <div role="tablist" class="tabs tabs-box tabs-sm grow-1">
          <button
            role="tab"
            class="tab flex-1"
            :class="{ 'tab-active': !isSignUp }"
            :disabled="isLoading"
            @click="switchMode(false)"
          >
            Iniciar sesión
          </button>
          <button
            role="tab"
            class="tab flex-1"
            :class="{ 'tab-active': isSignUp }"
            :disabled="isLoading"
            @click="switchMode(true)"
          >
            Crear una cuenta
          </button>
        </div>
      </div>

      <form class="mt-8 flex flex-col gap-4" @submit.prevent="handleSubmit">
        <label class="floating-label input w-full">
          <Mail class="size-4" />
          <span>Email</span>
          <input
            v-model="email"
            type="email"
            placeholder="Email"
            :disabled="isLoading"
            @keydown="handleKeydown"
          />
        </label>

        <label class="floating-label input w-full">
          <Key class="size-4" />
          <span>Contraseña</span>
          <input
            v-model="password"
            type="password"
            placeholder="Contraseña"
            :disabled="isLoading"
            @keydown="handleKeydown"
          />
        </label>

        <div v-if="error" class="alert alert-error">
          <span class="text-sm">{{ error }}</span>
        </div>

        <div v-if="successMessage" class="alert alert-success">
          <span class="text-sm">{{ successMessage }}</span>
        </div>

        <div class="mt-4 flex justify-end gap-3">
          <button type="submit" class="btn btn-primary" :disabled="isLoading">
            <template v-if="isLoading">
              <span class="loading loading-spinner loading-xs"></span>
              <span>{{ isSignUp ? "Creando..." : "Iniciando..." }}</span>
            </template>
            <template v-else>
              <UserPlus v-if="isSignUp" class="size-4" />
              <LogIn v-else class="size-4" />
              <span>{{ isSignUp ? "Crear cuenta" : "Iniciar sesión" }}</span>
            </template>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
