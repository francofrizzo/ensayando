<script setup lang="ts">
import { Key, LogIn, Mail, UserPlus, X } from "lucide-vue-next";
import { onMounted, ref } from "vue";

import { useAuthStore } from "@/stores/auth";

const emit = defineEmits<{
  close: [];
}>();

const authStore = useAuthStore();
const modalRef = ref<HTMLDialogElement>();

const email = ref("");
const password = ref("");
const isLoading = ref(false);
const error = ref("");
const isSignUp = ref(false);
const successMessage = ref("");

onMounted(() => {
  modalRef.value?.showModal();
});

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
        // Email confirmation required
        successMessage.value = "¡Cuenta creada! Revisa tu email para confirmar tu cuenta.";
      } else {
        // Auto-login successful
        closeModal();
      }
    } else {
      await authStore.signIn(email.value, password.value);
      closeModal();
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

const closeModal = () => {
  modalRef.value?.close();
  emit("close");
};
</script>

<template>
  <dialog ref="modalRef" class="modal">
    <div class="modal-box flex flex-col gap-6">
      <div class="flex items-center justify-between gap-6">
        <div class="w-10" />
        <div role="tablist" class="tabs tabs-box grow-1">
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
        <button class="btn btn-sm btn-square btn-ghost" @click="closeModal">
          <X class="size-4" />
        </button>
      </div>

      <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
        <label class="input w-full">
          <Mail class="size-4" />
          <span>Email</span>
          <input
            v-model="email"
            type="email"
            placeholder="tu@email.com"
            :disabled="isLoading"
            @keydown="handleKeydown"
          />
        </label>

        <label class="input w-full">
          <Key class="size-4" />
          <span>Contraseña</span>
          <input
            v-model="password"
            type="password"
            placeholder="••••••••"
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

        <div class="modal-action gap-4">
          <button type="button" class="btn btn-soft" :disabled="isLoading" @click="closeModal">
            Cancelar
          </button>
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

    <form method="dialog" class="modal-backdrop">
      <button @click="emit('close')">close</button>
    </form>
  </dialog>
</template>
