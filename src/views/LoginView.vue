<script setup lang="ts">
import { IconKey, IconLogIn, IconUser, IconUserPlus } from "@/components/ui/icons";
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { AdminManagedAccountError, useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const username = ref("");
const password = ref("");
const isLoading = ref(false);
const error = ref("");
const isSignUp = ref(false);
const successMessage = ref("");

const isSignUpEnabled = false;

// Forgot-password state
const isResetting = ref(false);
const resetNotice = ref<{ kind: "success" | "admin-managed"; text: string } | null>(null);

const looksLikeResettableEmail = computed(() => {
  const v = username.value.trim().toLowerCase();
  return v.includes("@") && !v.endsWith("@ensayando.com.ar");
});

onMounted(() => {
  // no-op; form is inline
});

watch(
  () => authStore.isAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated) {
      const redirect = route.query.redirect;
      const target = typeof redirect === "string" && redirect ? redirect : "/";
      router.replace(target);
    }
  },
  { immediate: true }
);

const handleSubmit = async () => {
  if (!username.value || !password.value) {
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
      const result = await authStore.signUp(username.value, password.value);
      if (result.user && !result.session) {
        successMessage.value = "¡Cuenta creada!";
      } else {
        // Auto-login
        // watcher will redirect
      }
    } else {
      await authStore.signIn(username.value, password.value);
      // watcher will redirect
    }
  } catch (err: unknown) {
    error.value =
      err instanceof Error
        ? err.message
        : `Error al ${isSignUp.value ? "registrarse" : "iniciar sesión"}`;
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

const handleForgotPassword = async () => {
  if (!username.value.trim() || isResetting.value) return;
  isResetting.value = true;
  error.value = "";
  successMessage.value = "";
  resetNotice.value = null;
  try {
    await authStore.requestPasswordReset(username.value);
    resetNotice.value = {
      kind: "success",
      text: "Te enviamos un email con instrucciones para restablecer tu contraseña."
    };
  } catch (err: unknown) {
    if (err instanceof AdminManagedAccountError) {
      resetNotice.value = {
        kind: "admin-managed",
        text: "Tu cuenta es administrada manualmente. Pedile al administrador que te la resetee."
      };
    } else {
      error.value = err instanceof Error ? err.message : "No se pudo enviar el email";
    }
  } finally {
    isResetting.value = false;
  }
};

watch(username, () => {
  resetNotice.value = null;
});
</script>

<template>
  <div
    class="bg-base-200 from-primary/15 flex min-h-dvh items-center justify-center bg-linear-to-t p-3 sm:p-6"
  >
    <div class="w-full max-w-md">
      <div
        class="mb-8 text-center"
        style="animation: empty-stagger 400ms ease-out both; animation-delay: 0ms"
      >
        <div class="mb-3 flex justify-center">
          <img src="/pwa-512x512.png" alt="Ensayando" class="h-16 w-16" />
        </div>
        <h1 class="text-3xl font-bold tracking-tight">Ensayando</h1>
      </div>

      <div
        class="bg-base-200/80 rounded-box p-4 shadow-lg sm:p-8"
        style="animation: empty-stagger 400ms ease-out both; animation-delay: 100ms"
      >
        <div v-if="isSignUpEnabled" role="tablist" class="tabs tabs-box mb-8 w-full">
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

        <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
          <label
            class="floating-label input input-bordered focus-within:border-primary w-full transition-shadow duration-200 focus-within:shadow-[0_0_0_2px_oklch(var(--color-primary)/0.15)]"
            style="animation: empty-stagger 400ms ease-out both; animation-delay: 180ms"
          >
            <IconUser class="size-4" />
            <span>Usuario o email</span>
            <input
              v-model="username"
              type="text"
              placeholder="Usuario o email"
              autocapitalize="none"
              autocomplete="username"
              :disabled="isLoading"
              @keydown="handleKeydown"
            />
          </label>

          <label
            class="floating-label input input-bordered focus-within:border-primary w-full transition-shadow duration-200 focus-within:shadow-[0_0_0_2px_oklch(var(--color-primary)/0.15)]"
            style="animation: empty-stagger 400ms ease-out both; animation-delay: 240ms"
          >
            <IconKey class="size-4" />
            <span>Contraseña</span>
            <input
              v-model="password"
              type="password"
              placeholder="Contraseña"
              :disabled="isLoading"
              @keydown="handleKeydown"
            />
          </label>

          <div v-if="!isSignUp && looksLikeResettableEmail" class="-mt-2 flex justify-end">
            <button
              type="button"
              class="link link-hover text-xs"
              :disabled="isResetting || isLoading"
              @click="handleForgotPassword"
            >
              <span v-if="isResetting" class="loading loading-spinner loading-xs"></span>
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <div
            v-if="resetNotice"
            class="alert"
            :class="resetNotice.kind === 'success' ? 'alert-success' : 'alert-info'"
          >
            <span class="text-sm">{{ resetNotice.text }}</span>
          </div>

          <div v-if="error" class="alert alert-error">
            <span class="text-sm">{{ error }}</span>
          </div>

          <div v-if="successMessage" class="alert alert-success">
            <span class="text-sm">{{ successMessage }}</span>
          </div>

          <button
            type="submit"
            class="btn btn-primary btn-block mt-4"
            :disabled="isLoading || !username || !password"
            style="animation: empty-stagger 400ms ease-out both; animation-delay: 300ms"
          >
            <template v-if="isLoading">
              <span class="loading loading-spinner loading-sm"></span>
              {{ isSignUp ? "Creando cuenta..." : "Iniciando sesión..." }}
            </template>
            <template v-else>
              <IconUserPlus v-if="isSignUp" class="h-5 w-5" />
              <IconLogIn v-else class="h-5 w-5" />
              {{ isSignUp ? "Crear cuenta" : "Iniciar sesión" }}
            </template>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
