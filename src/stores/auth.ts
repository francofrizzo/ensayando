import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";
import { defineStore } from "pinia";
import { computed, ref } from "vue";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(null);
  const isLoading = ref(true);

  const isAuthenticated = computed(() => {
    return user.value !== null;
  });

  const initAuth = async () => {
    isLoading.value = true;
    const {
      data: { session }
    } = await supabase.auth.getSession();
    user.value = session?.user ?? null;
    supabase.auth.onAuthStateChange((event, session) => {
      user.value = session?.user ?? null;
    });
    isLoading.value = false;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      throw error;
    }
    return data;
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: import.meta.env.VITE_SITE_URL
      }
    });
    if (error) {
      throw error;
    }
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated,
    initAuth,
    signIn,
    signUp,
    signOut
  };
});
