<script setup lang="ts">
// Where password-reset and invitation emails land (design/pantallas/ingreso-estados.html,
// "Contraseña nueva").
import { IconCheck, IconKey, IconLogIn } from "@/components/ui/icons";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import AuthShell from "@/components/auth/AuthShell.vue";
import * as supabase from "@/data/supabase";
import { useAuthStore } from "@/stores/auth";

// Supabase Auth's minimum password length.
const MIN_LENGTH = 6;

const authStore = useAuthStore();
const router = useRouter();

const password = ref("");
const confirmation = ref("");
const isLoading = ref(false);
const error = ref("");
const hasRecoverySession = ref(false);
const isCheckingSession = ref(true);

const tooShort = computed(() => password.value.length > 0 && password.value.length < MIN_LENGTH);
const mismatch = computed(
  () => confirmation.value.length > 0 && password.value !== confirmation.value
);
const isValid = computed(
  () => password.value.length >= MIN_LENGTH && password.value === confirmation.value
);

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
    await router.replace("/");
  } catch {
    error.value = "No se pudo guardar la contraseña. Probá de nuevo en un momento.";
    isLoading.value = false;
  }
};
</script>

<template>
  <AuthShell :title="!isCheckingSession && !hasRecoverySession ? 'Enlace vencido' : 'Elegí una contraseña'">
    <div v-if="isCheckingSession" class="flex justify-center py-8">
      <span class="loading loading-spinner loading-md"></span>
    </div>

    <div v-else-if="!hasRecoverySession" class="flex flex-col gap-4">
      <div class="alert alert-warning alert-soft">
        <span class="text-sm">
          Este enlace ya se usó o venció. Pedí uno nuevo desde la pantalla de ingreso.
        </span>
      </div>
      <router-link to="/login" class="btn btn-primary btn-block">
        <IconLogIn class="h-5 w-5" />
        Ir al ingreso
      </router-link>
    </div>

    <form v-else class="flex flex-col gap-4" @submit.prevent="handleSubmit">
      <div class="flex flex-col gap-1">
        <label
          class="floating-label input input-bordered w-full field-focus"
          style="animation: empty-stagger 400ms ease-out both; animation-delay: 180ms"
        >
          <IconKey class="size-4" />
          <span>Contraseña nueva</span>
          <input
            v-model="password"
            type="password"
            placeholder="Contraseña nueva"
            autocomplete="new-password"
            :disabled="isLoading"
            autofocus
          />
        </label>
        <span class="text-xs" :class="tooShort ? 'text-error' : 'text-base-content/60'">
          Al menos {{ MIN_LENGTH }} caracteres.
        </span>
      </div>

      <div class="flex flex-col gap-1">
        <label
          class="floating-label input input-bordered w-full field-focus"
          :class="{ 'input-error': mismatch }"
          style="animation: empty-stagger 400ms ease-out both; animation-delay: 240ms"
        >
          <IconKey class="size-4" />
          <span>Repetila</span>
          <input
            v-model="confirmation"
            type="password"
            placeholder="Repetila"
            autocomplete="new-password"
            :disabled="isLoading"
          />
        </label>
        <span v-if="mismatch" class="text-error text-xs">No coincide con la primera.</span>
      </div>

      <div v-if="error" class="alert alert-error">
        <span class="text-sm">{{ error }}</span>
      </div>

      <button
        type="submit"
        class="btn btn-primary btn-block mt-2"
        :disabled="!isValid || isLoading"
        style="animation: empty-stagger 400ms ease-out both; animation-delay: 300ms"
      >
        <template v-if="isLoading">
          <span class="loading loading-spinner loading-sm"></span>
          Guardando...
        </template>
        <template v-else>
          <IconCheck class="h-5 w-5" />
          Guardar y entrar
        </template>
      </button>
    </form>
  </AuthShell>
</template>
