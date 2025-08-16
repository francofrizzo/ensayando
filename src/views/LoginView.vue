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
  <div
    class="bg-base-200 from-primary/15 to-secondary/8 flex min-h-dvh items-center justify-center bg-linear-to-t p-3 sm:p-6"
  >
    <div class="w-full max-w-md">
      <div class="mb-8 text-center">
        <div class="mb-3 flex justify-center">
          <img src="/pwa-512x512.png" alt="Ensayando" class="h-16 w-16" />
        </div>
        <h1 class="text-3xl font-bold tracking-tight">Ensayando</h1>
      </div>

      <div class="bg-base-200/80 rounded-box p-4 shadow-lg sm:p-8">
        <div role="tablist" class="tabs tabs-box w-full">
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
            Crear cuenta
          </button>
        </div>

        <form class="mt-8 flex flex-col gap-4" @submit.prevent="handleSubmit">
          <label class="floating-label input input-bordered w-full">
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

          <label class="floating-label input input-bordered w-full">
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

          <button
            type="submit"
            class="btn btn-primary btn-block mt-4"
            :disabled="isLoading || !email || !password"
          >
            <template v-if="isLoading">
              <span class="loading loading-spinner loading-sm"></span>
              {{ isSignUp ? "Creando cuenta..." : "Iniciando sesión..." }}
            </template>
            <template v-else>
              <UserPlus v-if="isSignUp" class="h-5 w-5" />
              <LogIn v-else class="h-5 w-5" />
              {{ isSignUp ? "Crear cuenta" : "Iniciar sesión" }}
            </template>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
