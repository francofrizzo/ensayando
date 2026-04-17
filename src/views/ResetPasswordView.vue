<script setup lang="ts">
import { IconKey, IconSave } from "@/components/ui/icons";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import * as supabase from "@/data/supabase";
import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
const router = useRouter();

const password = ref("");
const confirmation = ref("");
const isLoading = ref(false);
const error = ref("");
const successMessage = ref("");
const hasRecoverySession = ref(false);
const isCheckingSession = ref(true);

const isValid = computed(() => password.value.length >= 6 && password.value === confirmation.value);

onMounted(async () => {
  // Supabase's client auto-detects the recovery token in the URL hash and
  // exchanges it for a session on page load. Wait for that to settle, then
  // confirm we have a session before showing the form.
  const sub = supabase.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
      hasRecoverySession.value = true;
    }
  });
  const { data } = await supabase.getSession();
  if (data.session) {
    hasRecoverySession.value = true;
  }
  isCheckingSession.value = false;

  // Stop listening once we've settled initial state.
  setTimeout(() => sub.data.subscription.unsubscribe(), 5000);
});

const handleSubmit = async () => {
  if (!isValid.value || isLoading.value) return;
  isLoading.value = true;
  error.value = "";
  try {
    await authStore.updatePassword(password.value);
    successMessage.value = "Contraseña actualizada. Redirigiéndote...";
    setTimeout(() => router.replace("/"), 1200);
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : "No se pudo actualizar la contraseña";
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div
    class="bg-base-200 from-primary/15 flex min-h-dvh items-center justify-center bg-linear-to-t p-3 sm:p-6"
  >
    <div class="w-full max-w-md">
      <div class="mb-8 text-center">
        <div class="mb-3 flex justify-center">
          <img src="/pwa-512x512.png" alt="Ensayando" class="h-16 w-16" />
        </div>
        <h1 class="text-3xl font-bold tracking-tight">Nueva contraseña</h1>
      </div>

      <div class="bg-base-200/80 rounded-box p-4 shadow-lg sm:p-8">
        <div v-if="isCheckingSession" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-md"></span>
        </div>

        <div v-else-if="!hasRecoverySession" class="flex flex-col gap-4">
          <div class="alert alert-warning">
            <span class="text-sm">
              Este link no es válido o expiró. Pedí uno nuevo desde la pantalla de inicio de sesión.
            </span>
          </div>
          <router-link to="/login" class="btn btn-primary btn-block">Volver al inicio</router-link>
        </div>

        <form v-else class="flex flex-col gap-4" @submit.prevent="handleSubmit">
          <label
            class="floating-label input input-bordered focus-within:border-primary w-full transition-shadow duration-200 focus-within:shadow-[0_0_0_2px_oklch(var(--color-primary)/0.15)]"
          >
            <IconKey class="size-4" />
            <span>Contraseña nueva</span>
            <input
              v-model="password"
              type="password"
              placeholder="Contraseña nueva"
              autocomplete="new-password"
              :disabled="isLoading"
            />
          </label>

          <label
            class="floating-label input input-bordered focus-within:border-primary w-full transition-shadow duration-200 focus-within:shadow-[0_0_0_2px_oklch(var(--color-primary)/0.15)]"
          >
            <IconKey class="size-4" />
            <span>Repetir contraseña</span>
            <input
              v-model="confirmation"
              type="password"
              placeholder="Repetir contraseña"
              autocomplete="new-password"
              :disabled="isLoading"
            />
          </label>

          <p
            v-if="password && confirmation && password !== confirmation"
            class="text-error text-xs"
          >
            Las contraseñas no coinciden.
          </p>
          <p v-else-if="password && password.length < 6" class="text-base-content/60 text-xs">
            Debe tener al menos 6 caracteres.
          </p>

          <div v-if="error" class="alert alert-error">
            <span class="text-sm">{{ error }}</span>
          </div>

          <div v-if="successMessage" class="alert alert-success">
            <span class="text-sm">{{ successMessage }}</span>
          </div>

          <button
            type="submit"
            class="btn btn-primary btn-block mt-4"
            :disabled="!isValid || isLoading"
          >
            <template v-if="isLoading">
              <span class="loading loading-spinner loading-sm"></span>
              Guardando...
            </template>
            <template v-else>
              <IconSave class="h-5 w-5" />
              Guardar contraseña
            </template>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
