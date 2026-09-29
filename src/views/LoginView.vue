<script setup lang="ts">
import { IconBack, IconKey, IconLogIn, IconMail, IconUser, IconUserPlus } from "@/components/ui/icons";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import AuthShell from "@/components/auth/AuthShell.vue";
import { AdminManagedAccountError, useAuthStore } from "@/stores/auth";
import { loginErrorMessage } from "@/utils/authErrors";

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

// Passwordless login: once the link is on its way, the form shows where it went.
// Supabase lets an address ask for another email after a minute (auth.email.max_frequency).
const RESEND_AFTER_MS = 60_000;
const linkEmail = ref<string | null>(null);
const isSendingLink = ref(false);
const resendAt = ref(0);
const now = ref(Date.now());
const ticker = setInterval(() => (now.value = Date.now()), 1000);
onBeforeUnmount(() => clearInterval(ticker));
const resendIn = computed(() => Math.max(0, Math.ceil((resendAt.value - now.value) / 1000)));

// An expired or already-used link comes back as #error_code=otp_expired.
if (new URLSearchParams(window.location.hash.slice(1)).get("error_code") === "otp_expired") {
  error.value = "Ese enlace ya se usó o venció. Pedí otro.";
  history.replaceState(null, "", window.location.pathname + window.location.search);
}

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
    error.value = "Completá el usuario y la contraseña.";
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
    error.value = isSignUp.value
      ? err instanceof Error
        ? err.message
        : "Error al registrarse"
      : loginErrorMessage(err);
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
        text: "Tu cuenta la administra la persona a cargo de la colección. Si no te acordás la contraseña, pedile que te la restablezca."
      };
    } else {
      error.value = err instanceof Error ? err.message : "No se pudo enviar el email";
    }
  } finally {
    isResetting.value = false;
  }
};

const sendLink = async () => {
  const email = linkEmail.value ?? username.value.trim().toLowerCase();
  if (!email || isSendingLink.value || resendIn.value > 0) return;
  isSendingLink.value = true;
  error.value = "";
  resetNotice.value = null;
  try {
    // Back to the login screen, which forwards to ?redirect= once signed in.
    const redirect = typeof route.query.redirect === "string" ? route.query.redirect : "";
    const target = `${window.location.origin}/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`;
    await authStore.requestLoginLink(email, target);
    linkEmail.value = email;
    resendAt.value = Date.now() + RESEND_AFTER_MS;
  } catch (err: unknown) {
    error.value = loginErrorMessage(err);
  } finally {
    isSendingLink.value = false;
  }
};

const usePassword = () => {
  linkEmail.value = null;
  error.value = "";
};

watch(username, () => {
  resetNotice.value = null;
});
</script>

<template>
  <AuthShell title="Ensayando">
    <div v-if="isSignUpEnabled && !linkEmail" role="tablist" class="tabs tabs-box mb-8 w-full">
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

    <div v-if="linkEmail" class="flex flex-col gap-4">
      <div class="alert alert-success alert-soft">
        <IconMail class="size-5" />
        <span class="text-sm">
          Te mandamos un enlace a <strong class="break-all">{{ linkEmail }}</strong>. Abrilo en este
          dispositivo para entrar.
        </span>
      </div>

      <div v-if="error" class="alert alert-error">
        <span class="text-sm">{{ error }}</span>
      </div>

      <div class="flex items-center justify-between text-xs">
        <button type="button" class="link link-hover inline-flex items-center gap-1" @click="usePassword">
          <IconBack class="size-3.5" />
          Usar contraseña
        </button>
        <button
          type="button"
          class="link link-hover disabled:no-underline disabled:opacity-50"
          :disabled="isSendingLink || resendIn > 0"
          @click="sendLink"
        >
          <span v-if="isSendingLink" class="loading loading-spinner loading-xs"></span>
          {{ resendIn > 0 ? `Reenviar en ${resendIn} s` : "Reenviar enlace" }}
        </button>
      </div>
    </div>

    <form v-else class="flex flex-col gap-4" @submit.prevent="handleSubmit">
      <label
        class="floating-label input input-bordered w-full field-focus"
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
        class="floating-label input input-bordered w-full field-focus"
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

      <div
        v-if="!isSignUp && looksLikeResettableEmail"
        class="-mt-2 flex items-center justify-between gap-3 text-xs"
      >
        <button
          type="button"
          class="link link-hover inline-flex items-center gap-1"
          :disabled="isSendingLink || isLoading"
          @click="sendLink"
        >
          <span v-if="isSendingLink" class="loading loading-spinner loading-xs"></span>
          <IconMail v-else class="size-3.5" />
          Entrar sin contraseña
        </button>
        <button
          type="button"
          class="link link-hover"
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
  </AuthShell>
</template>
