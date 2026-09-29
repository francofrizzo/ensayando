<script setup lang="ts">
import { computed, ref, watch } from "vue";

import { IconKey, IconMail, IconSearch, IconUserPlus } from "@/components/ui/icons";
import {
  addMember,
  AdminError,
  createManagedAccount,
  findAccount,
  inviteMember
} from "@/data/admin";
import type { AccountMatch, CollectionMember, CollectionRole, CollectionWithRole } from "@/data/types";
import { ROLE_LABELS } from "@/utils/collectionSettings";

const props = defineProps<{
  open: boolean;
  collection: CollectionWithRole;
  members: CollectionMember[];
}>();
const emit = defineEmits<{
  close: [];
  added: [message: string];
  created: [account: { username: string; password: string }];
}>();

type Mode = "existing" | "managed" | "email";
const mode = ref<Mode>("managed");
const query = ref("");
const results = ref<AccountMatch[]>([]);
const searching = ref(false);
const picked = ref<AccountMatch | null>(null);
const username = ref("");
const email = ref("");
const role = ref<CollectionRole>("viewer");
const busy = ref(false);
const error = ref("");

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    mode.value = "managed";
    query.value = "";
    results.value = [];
    picked.value = null;
    username.value = "";
    email.value = "";
    role.value = "viewer";
    error.value = "";
  }
);

let timer: ReturnType<typeof setTimeout> | undefined;
watch(query, (value) => {
  clearTimeout(timer);
  picked.value = null;
  if (value.trim().length < 3) {
    results.value = [];
    return;
  }
  timer = setTimeout(async () => {
    searching.value = true;
    try {
      results.value = await findAccount(value.trim());
    } catch (e) {
      error.value = e instanceof AdminError ? e.message : "No se pudo buscar.";
    } finally {
      searching.value = false;
    }
  }, 300);
});

const isMember = (account: AccountMatch) => props.members.some((m) => m.user_id === account.user_id);

function pick(account: AccountMatch) {
  if (isMember(account)) return;
  picked.value = account;
  mode.value = "existing";
}

const canSubmit = computed(() => {
  if (busy.value) return false;
  if (mode.value === "existing") return !!picked.value;
  if (mode.value === "managed") return username.value.trim().length >= 3;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
});

const submitLabel = computed(
  () => ({ existing: "Agregar", managed: "Crear y agregar", email: "Invitar" })[mode.value]
);

async function submit() {
  if (!canSubmit.value) return;
  busy.value = true;
  error.value = "";
  try {
    if (mode.value === "existing" && picked.value) {
      await addMember(props.collection.id, picked.value.user_id, role.value);
      emit("added", `Sumaste a ${picked.value.username}`);
    } else if (mode.value === "managed") {
      const account = await createManagedAccount(props.collection.id, username.value.trim(), role.value);
      emit("created", { username: account.username, password: account.password });
    } else {
      const invited = await inviteMember(props.collection.id, email.value.trim(), role.value);
      emit("added", `Le mandamos una invitación a ${invited.email}`);
    }
  } catch (e) {
    error.value = e instanceof AdminError ? e.message : "No se pudo agregar. Probá de nuevo.";
  } finally {
    busy.value = false;
  }
}

const ROLES: CollectionRole[] = ["admin", "editor", "viewer"];
</script>

<template>
  <dialog class="modal modal-bottom sm:modal-middle" :class="{ 'modal-open': props.open }">
    <div v-if="props.open" class="modal-box glass-3 flex flex-col gap-4" data-testid="add-member-dialog">
      <div>
        <h3 class="font-display text-xl font-bold">Agregar persona</h3>
        <p class="text-base-content/60 text-sm">Sumala a {{ props.collection.title }}.</p>
      </div>

      <label class="flex flex-col gap-1.5">
        <span class="text-base-content/70 text-sm font-semibold">Buscar una cuenta existente</span>
        <span class="input w-full" :class="{ 'input-primary': mode === 'existing' }">
          <IconSearch class="size-4 opacity-60" />
          <input
            v-model="query"
            class="grow"
            placeholder="Usuario o email exacto"
            autocapitalize="none"
            spellcheck="false"
          />
          <span v-if="searching" class="loading loading-spinner loading-xs" />
          <span
            v-else-if="query.trim().length >= 3 && results.length === 0"
            class="text-base-content/50 text-xs"
            >Sin resultados</span
          >
        </span>
      </label>
      <ul v-if="results.length" class="flex flex-col gap-1">
        <li v-for="account in results" :key="account.user_id">
          <button
            class="flex w-full items-center gap-3 rounded-lg border p-2.5 text-left"
            :class="
              picked?.user_id === account.user_id
                ? 'border-primary bg-primary/10'
                : 'border-base-content/10 hover:bg-base-content/5'
            "
            :disabled="isMember(account)"
            @click="pick(account)"
          >
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="font-semibold">{{ account.username }}</span>
              <span class="text-base-content/50 truncate font-mono text-xs">{{ account.email }}</span>
            </span>
            <span class="badge badge-sm badge-ghost">
              {{ isMember(account) ? "Ya está" : account.is_managed ? "Administrada" : "Con email" }}
            </span>
          </button>
        </li>
      </ul>

      <span class="text-base-content/70 text-sm font-semibold">O crear una cuenta nueva</span>
      <button
        class="rounded-box flex items-start gap-3 border p-3 text-left"
        :class="mode === 'managed' ? 'border-primary bg-primary/10' : 'border-base-content/10'"
        @click="mode = 'managed'"
      >
        <IconKey class="mt-0.5 size-4" />
        <span class="flex flex-col gap-0.5">
          <span class="font-semibold">Cuenta administrada</span>
          <span class="text-base-content/60 text-xs">
            Solo usuario y contraseña. Vos le pasás los datos. Para restablecerla, lo hacés desde acá.
          </span>
        </span>
      </button>
      <label v-if="mode === 'managed'" class="flex flex-col gap-1.5">
        <span class="text-base-content/70 text-sm font-semibold">Usuario</span>
        <input
          v-model="username"
          class="input w-full font-mono"
          placeholder="martin.b"
          autocapitalize="none"
          spellcheck="false"
          data-testid="managed-username"
        />
        <span class="text-base-content/50 text-xs">
          La contraseña se genera sola y la ves una vez, al crear la cuenta.
        </span>
      </label>
      <button
        class="rounded-box flex items-start gap-3 border p-3 text-left"
        :class="mode === 'email' ? 'border-primary bg-primary/10' : 'border-base-content/10'"
        @click="mode = 'email'"
      >
        <IconMail class="mt-0.5 size-4" />
        <span class="flex flex-col gap-0.5">
          <span class="font-semibold">Invitar por email</span>
          <span class="text-base-content/60 text-xs">
            Recibe un enlace para elegir su contraseña. Puede restablecerla sola.
          </span>
        </span>
      </button>
      <label v-if="mode === 'email'" class="flex flex-col gap-1.5">
        <span class="text-base-content/70 text-sm font-semibold">Email</span>
        <input
          v-model="email"
          type="email"
          class="input w-full"
          placeholder="sofia@ejemplo.com"
          autocapitalize="none"
        />
      </label>

      <div class="flex flex-col gap-1.5">
        <span class="text-base-content/70 text-sm font-semibold">Rol</span>
        <div class="join">
          <button
            v-for="r in ROLES"
            :key="r"
            class="btn btn-sm join-item flex-1"
            :class="role === r ? 'btn-active' : 'btn-ghost'"
            @click="role = r"
          >
            {{ ROLE_LABELS[r] }}
          </button>
        </div>
      </div>

      <p v-if="error" class="text-error text-sm" data-testid="add-member-error">{{ error }}</p>

      <div class="modal-action mt-0">
        <button class="btn btn-ghost" :disabled="busy" @click="emit('close')">Cancelar</button>
        <button class="btn btn-primary" :disabled="!canSubmit" data-testid="add-member-submit" @click="submit">
          <span v-if="busy" class="loading loading-spinner loading-xs" />
          <IconUserPlus v-else class="size-4" />
          {{ submitLabel }}
        </button>
      </div>
    </div>
    <div class="modal-backdrop" @click="!busy && emit('close')" />
  </dialog>
</template>
