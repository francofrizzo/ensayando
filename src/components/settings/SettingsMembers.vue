<script setup lang="ts">
import { computed, ref } from "vue";
import { toast } from "vue-sonner";

import AddMemberDialog from "@/components/settings/AddMemberDialog.vue";
import OneTimePasswordDialog from "@/components/settings/OneTimePasswordDialog.vue";
import SegmentedControl from "@/components/settings/SegmentedControl.vue";
import SettingsSection from "@/components/settings/SettingsSection.vue";
import {
  IconCopy,
  IconKey,
  IconLogOut,
  IconMail,
  IconMore,
  IconSearch,
  IconUserPlus
} from "@/components/ui/icons";
import { AdminError, removeMember, resetAccountPassword, setMemberRole } from "@/data/admin";
import type { CollectionMember, CollectionRole, CollectionWithRole } from "@/data/types";
import { useAuthStore } from "@/stores/auth";
import { initials, lastSignInLabel, ROLE_LABELS } from "@/utils/collectionSettings";

const props = defineProps<{
  collection: CollectionWithRole;
  members: CollectionMember[];
  loadError?: string;
}>();
const emit = defineEmits<{ refresh: [] }>();

const authStore = useAuthStore();
const filter = ref("");
const busyId = ref<string | null>(null);

const visible = computed(() => {
  const q = filter.value.trim().toLowerCase();
  if (!q) return props.members;
  return props.members.filter(
    (m) => m.username.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
  );
});

const adminCount = computed(() => props.members.filter((m) => m.role === "admin").length);
const isSelf = (m: CollectionMember) => m.user_id === authStore.user?.id;
const isLastAdmin = (m: CollectionMember) => m.role === "admin" && adminCount.value <= 1;
const roleLocked = (m: CollectionMember) => isSelf(m) || isLastAdmin(m);

const handle = (m: CollectionMember) => (m.is_managed ? m.username : m.email);

async function run(member: CollectionMember, action: () => Promise<void>) {
  busyId.value = member.user_id;
  try {
    await action();
  } catch (e) {
    toast.error(e instanceof AdminError ? e.message : "Algo falló. Probá de nuevo.");
  } finally {
    busyId.value = null;
  }
}

function changeRole(member: CollectionMember, role: CollectionRole) {
  if (role === member.role) return;
  void run(member, async () => {
    await setMemberRole(props.collection.id, member.user_id, role);
    toast.success(`${member.username} ahora es ${ROLE_LABELS[role].toLowerCase()}`);
    emit("refresh");
  });
}

const password = ref<{ username: string; password: string; isNew: boolean } | null>(null);

function resetPassword(member: CollectionMember) {
  void run(member, async () => {
    const result = await resetAccountPassword(member.user_id);
    if (result.kind === "password") {
      password.value = { username: member.username, password: result.password, isNew: false };
    } else {
      toast.success(`Le mandamos un enlace a ${result.email}`);
    }
  });
}

async function copyHandle(member: CollectionMember) {
  try {
    await navigator.clipboard.writeText(handle(member));
    toast.success(member.is_managed ? "Usuario copiado" : "Email copiado");
  } catch {
    toast.error(handle(member));
  }
}

const toRemove = ref<CollectionMember | null>(null);
function confirmRemove() {
  const member = toRemove.value;
  if (!member) return;
  toRemove.value = null;
  void run(member, async () => {
    await removeMember(props.collection.id, member.user_id);
    toast.success(`Quitaste a ${member.username} de la colección`);
    emit("refresh");
  });
}

// Phone: tapping a person opens a sheet with the role and the actions.
const sheet = ref<CollectionMember | null>(null);

const adding = ref(false);
function onAdded(message: string) {
  adding.value = false;
  toast.success(message);
  emit("refresh");
}
function onCreated(account: { username: string; password: string }) {
  adding.value = false;
  password.value = { ...account, isNew: true };
  emit("refresh");
}

const ROLES: CollectionRole[] = ["admin", "editor", "viewer"];
</script>

<template>
  <SettingsSection title="Miembros" description="Quién puede entrar a esta colección y qué puede hacer.">
    <template #actions>
      <button class="btn btn-primary btn-sm" data-testid="add-member" @click="adding = true">
        <IconUserPlus class="size-4" /> Agregar persona
      </button>
    </template>

    <label
      class="input focus-within:shadow-[inset_0_0_0_1.5px_var(--collection-ink),0_0_0_4px_color-mix(in_oklab,var(--color-primary)_15%,transparent)] w-full max-w-sm focus-within:outline-none"
    >
      <IconSearch class="size-4 opacity-60" />
      <input v-model="filter" class="grow" placeholder="Buscar por nombre, usuario o email" />
    </label>

    <p v-if="props.loadError" class="text-error text-sm">{{ props.loadError }}</p>

    <!-- desktop table -->
    <div class="bg-base-100 rounded-box border-base-content/10 hidden border md:block">
      <table class="table" data-testid="members-table">
        <thead>
          <tr class="text-base-content/60 text-[11px] tracking-wider uppercase">
            <th>Persona</th>
            <th>Cuenta</th>
            <th>Rol</th>
            <th>Último ingreso</th>
            <th class="w-10"><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in visible" :key="m.user_id" :data-testid="`member-${m.username}`">
            <td>
              <div class="flex items-center gap-3">
                <span
                  class="bg-primary/15 text-primary grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold"
                  >{{ initials(m.username) }}</span
                >
                <div class="flex min-w-0 flex-col">
                  <span class="flex items-center gap-2 font-semibold">
                    {{ m.username }}
                    <span v-if="isSelf(m)" class="badge badge-xs badge-ghost">Vos</span>
                  </span>
                  <span class="text-base-content/50 truncate font-mono text-xs">{{ handle(m) }}</span>
                </div>
              </div>
            </td>
            <td>
              <span class="badge badge-sm badge-ghost gap-1">
                <IconKey v-if="m.is_managed" class="size-3" />
                <IconMail v-else class="size-3" />
                {{ m.is_managed ? "Administrada" : "Con email" }}
              </span>
            </td>
            <td>
              <select
                class="select select-sm w-28"
                :value="m.role"
                :disabled="roleLocked(m) || busyId === m.user_id"
                :title="roleLocked(m) ? 'No podés cambiar tu propio rol ni dejar la colección sin admin' : ''"
                @change="changeRole(m, ($event.target as HTMLSelectElement).value as CollectionRole)"
              >
                <option v-for="r in ROLES" :key="r" :value="r">{{ ROLE_LABELS[r] }}</option>
              </select>
            </td>
            <td class="text-base-content/70 text-sm">{{ lastSignInLabel(m.last_sign_in_at) }}</td>
            <td>
              <div class="dropdown dropdown-end">
                <button tabindex="0" class="btn btn-ghost btn-sm btn-square" aria-label="Más acciones">
                  <span v-if="busyId === m.user_id" class="loading loading-spinner loading-xs" />
                  <IconMore v-else class="size-4" />
                </button>
                <ul tabindex="0" class="dropdown-content menu glass-3 rounded-box z-30 w-64 p-1.5">
                  <li class="menu-title text-[11px] tracking-wider uppercase">
                    {{ m.username }} · {{ m.is_managed ? "administrada" : "con email" }}
                  </li>
                  <li v-if="!isSelf(m)">
                    <button @click="resetPassword(m)">
                      <IconKey v-if="m.is_managed" class="size-4" />
                      <IconMail v-else class="size-4" />
                      {{ m.is_managed ? "Generar contraseña nueva" : "Enviar email para restablecer" }}
                    </button>
                  </li>
                  <li>
                    <button @click="copyHandle(m)">
                      <IconCopy class="size-4" /> {{ m.is_managed ? "Copiar usuario" : "Copiar email" }}
                    </button>
                  </li>
                  <div class="border-base-content/10 my-1 border-t" />
                  <li :class="{ 'menu-disabled': roleLocked(m) }">
                    <button class="text-error" :disabled="roleLocked(m)" @click="toRemove = m">
                      <IconLogOut class="size-4" /> Quitar acceso a la colección
                    </button>
                  </li>
                </ul>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- phone list -->
    <ul class="bg-base-100 rounded-box border-base-content/10 flex flex-col border md:hidden">
      <li
        v-for="m in visible"
        :key="m.user_id"
        class="border-base-content/10 flex items-center gap-3 p-3 not-last:border-b"
        @click="sheet = m"
      >
        <span
          class="bg-primary/15 text-primary grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold"
          >{{ initials(m.username) }}</span
        >
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="font-semibold">{{ m.username }}</span>
          <span class="text-base-content/60 text-xs">
            {{ ROLE_LABELS[m.role] }} · {{ m.is_managed ? "Administrada" : "Con email" }} ·
            {{ lastSignInLabel(m.last_sign_in_at) }}
          </span>
        </span>
        <IconMore class="size-4 opacity-60" />
      </li>
    </ul>

    <p class="text-base-content/50 px-1 text-xs">
      No podés cambiar tu propio rol ni quitarte acceso si sos el único admin.
    </p>

    <!-- phone sheet -->
    <dialog class="modal modal-bottom" :class="{ 'modal-open': !!sheet }">
      <div v-if="sheet" class="modal-box glass-3 flex flex-col gap-3">
        <div class="flex items-center gap-3">
          <span
            class="bg-primary/15 text-primary grid size-10 place-items-center rounded-full text-sm font-bold"
            >{{ initials(sheet.username) }}</span
          >
          <div class="flex flex-col">
            <span class="font-semibold">{{ sheet.username }}</span>
            <span class="text-base-content/60 text-xs">
              {{ sheet.is_managed ? "Cuenta administrada" : "Cuenta con email" }} ·
              {{ lastSignInLabel(sheet.last_sign_in_at) }}
            </span>
          </div>
        </div>
        <span class="text-base-content/70 text-sm font-semibold">Rol</span>
        <SegmentedControl
          :model-value="sheet.role"
          :options="ROLES.map((value) => ({ value, label: ROLE_LABELS[value] }))"
          :disabled="roleLocked(sheet)"
          label="Rol"
          stretch
          @update:model-value="
            changeRole(sheet, $event);
            sheet = null;
          "
        />
        <ul class="menu w-full p-0">
          <li v-if="!isSelf(sheet)">
            <button @click="resetPassword(sheet); sheet = null">
              <IconKey class="size-4" />
              {{ sheet.is_managed ? "Generar contraseña nueva" : "Enviar email para restablecer" }}
            </button>
          </li>
          <li>
            <button @click="copyHandle(sheet)">
              <IconCopy class="size-4" /> {{ sheet.is_managed ? "Copiar usuario" : "Copiar email" }}
            </button>
          </li>
          <li v-if="!roleLocked(sheet)">
            <button class="text-error" @click="toRemove = sheet; sheet = null">
              <IconLogOut class="size-4" /> Quitar acceso
            </button>
          </li>
        </ul>
      </div>
      <div class="modal-backdrop" @click="sheet = null" />
    </dialog>

    <!-- remove confirmation -->
    <dialog class="modal" :class="{ 'modal-open': !!toRemove }">
      <div v-if="toRemove" class="modal-box glass-3 flex max-w-sm flex-col gap-3">
        <h3 class="font-display text-lg font-bold">¿Quitar a {{ toRemove.username }}?</h3>
        <p class="text-base-content/70 text-sm">
          Deja de ver esta colección. Su cuenta no se borra y sigue en las otras colecciones.
        </p>
        <div class="modal-action mt-0">
          <button class="btn btn-ghost" @click="toRemove = null">Cancelar</button>
          <button class="btn btn-error" data-testid="confirm-remove" @click="confirmRemove">Quitar acceso</button>
        </div>
      </div>
      <div class="modal-backdrop" @click="toRemove = null" />
    </dialog>

    <AddMemberDialog
      :open="adding"
      :collection="props.collection"
      :members="props.members"
      @close="adding = false"
      @added="onAdded"
      @created="onCreated"
    />
    <OneTimePasswordDialog
      :open="!!password"
      :username="password?.username ?? ''"
      :password="password?.password ?? ''"
      :is-new="password?.isNew"
      @close="password = null"
    />
  </SettingsSection>
</template>
