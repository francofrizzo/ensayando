import type { User } from "@supabase/supabase-js";
import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { fetchIsAppAdmin } from "@/data/admin";
import * as supabase from "@/data/supabase";
import { useCollectionsStore } from "@/stores/collections";
import { useSongIndexStore } from "@/stores/songIndex";

const EMAIL_DOMAIN = "ensayando.com.ar";

const resolveEmail = (input: string) => {
  const trimmed = input.trim().toLowerCase();
  return trimmed.includes("@") ? trimmed : `${trimmed}@${EMAIL_DOMAIN}`;
};

export const isAdminManagedEmail = (email: string) => {
  const e = email.trim().toLowerCase();
  return !e.includes("@") || e.endsWith(`@${EMAIL_DOMAIN}`);
};

export class AdminManagedAccountError extends Error {
  constructor() {
    super("admin-managed");
    this.name = "AdminManagedAccountError";
  }
}

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(null);
  const isLoading = ref(true);
  const lastUserId = ref<string | null>(null);
  // Whether the person is in app_admins (can create collections). Fetched once per sign-in.
  const isAppAdmin = ref(false);

  const isAuthenticated = computed(() => {
    return user.value !== null;
  });

  const username = computed(() => {
    return user.value?.user_metadata?.username ?? null;
  });

  const handleAuthChange = (newUser: User | null) => {
    const collectionsStore = useCollectionsStore();
    const newUserId = newUser?.id ?? null;
    if (newUserId !== lastUserId.value) {
      collectionsStore.reset();
      useSongIndexStore().reset();
      lastUserId.value = newUserId;
      isAppAdmin.value = false;
      if (newUserId) {
        void fetchIsAppAdmin().then((value) => {
          if (lastUserId.value === newUserId) isAppAdmin.value = value;
        });
      }
    }
  };

  const initAuth = async () => {
    isLoading.value = true;
    const {
      data: { session }
    } = await supabase.getSession();
    user.value = session?.user ?? null;
    handleAuthChange(user.value);
    supabase.onAuthStateChange((event, session) => {
      user.value = session?.user ?? null;
      handleAuthChange(user.value);
    });
    isLoading.value = false;
  };

  const signIn = async (usernameInput: string, password: string) => {
    const email = resolveEmail(usernameInput);
    const { data, error } = await supabase.signInWithPassword(email, password);
    if (error) {
      throw error;
    }
    return data;
  };

  const signUp = async (usernameInput: string, password: string) => {
    const email = resolveEmail(usernameInput);
    const { data, error } = await supabase.signUp(email, password, usernameInput.trim());
    if (error) {
      throw error;
    }
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.signOut();
    if (error) {
      throw error;
    }
  };

  const requestPasswordReset = async (emailInput: string) => {
    const email = emailInput.trim().toLowerCase();
    if (isAdminManagedEmail(email)) {
      throw new AdminManagedAccountError();
    }
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.resetPasswordForEmail(email, redirectTo);
    if (error) {
      throw error;
    }
  };

  /** Mails a sign-in link to a real email. Managed accounts have no inbox. */
  const requestLoginLink = async (emailInput: string, redirectTo: string) => {
    const email = emailInput.trim().toLowerCase();
    if (isAdminManagedEmail(email)) {
      throw new AdminManagedAccountError();
    }
    const { error } = await supabase.sendLoginLink(email, redirectTo);
    if (error) {
      throw error;
    }
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.updatePassword(newPassword);
    if (error) {
      throw error;
    }
  };

  return {
    user,
    username,
    isLoading,
    isAuthenticated,
    isAppAdmin,
    initAuth,
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
    requestLoginLink,
    updatePassword
  };
});
