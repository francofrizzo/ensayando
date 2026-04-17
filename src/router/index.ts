import { watch } from "vue";
import { createRouter, createWebHistory } from "vue-router";

import { useAuthStore } from "@/stores/auth";

export type GuardInput = {
  requiresAuth: boolean;
  isAuthenticated: boolean;
  isLoginPage: boolean;
  redirectQuery: unknown;
  fullPath: string;
};

export type GuardResult =
  | { action: "redirect-to-login"; redirect: string }
  | { action: "redirect-after-login"; path: string }
  | { action: "proceed" };

export function resolveGuard(input: GuardInput): GuardResult {
  if (input.requiresAuth && !input.isAuthenticated) {
    return { action: "redirect-to-login", redirect: input.fullPath };
  }

  if (input.isLoginPage && input.isAuthenticated) {
    const redirect = input.redirectQuery;
    const path = typeof redirect === "string" && redirect ? redirect : "/";
    return { action: "redirect-after-login", path };
  }

  return { action: "proceed" };
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: () => import("@/views/HomeView.vue"),
      meta: {
        requiresAuth: true
      }
    },
    {
      path: "/login",
      name: "login",
      component: () => import("@/views/LoginView.vue"),
      meta: {
        requiresAuth: false
      }
    },
    {
      path: "/reset-password",
      name: "reset-password",
      component: () => import("@/views/ResetPasswordView.vue"),
      meta: {
        requiresAuth: false
      }
    },
    {
      path: "/:collectionSlug",
      name: "collection",
      component: () => import("@/views/CollectionView.vue"),
      props: true
    },
    {
      path: "/:collectionSlug/:songSlug",
      name: "song",
      component: () => import("@/views/SongView.vue"),
      props: true
    },
    {
      path: "/404",
      name: "not-found",
      component: () => import("@/views/NotFoundView.vue")
    },
    {
      path: "/:pathMatch(.*)*",
      redirect: "/404"
    }
  ]
});

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();

  // Wait until auth initialization completes before making decisions
  if (authStore.isLoading) {
    await new Promise<void>((resolve) => {
      const stop = watch(
        () => authStore.isLoading,
        (loading) => {
          if (!loading) {
            stop();
            resolve();
          }
        },
        { immediate: true }
      );
    });
  }

  const result = resolveGuard({
    requiresAuth: !!to.meta.requiresAuth,
    isAuthenticated: authStore.isAuthenticated,
    isLoginPage: to.name === "login",
    redirectQuery: to.query.redirect,
    fullPath: to.fullPath
  });

  if (result.action === "redirect-to-login") {
    next({ name: "login", query: { redirect: result.redirect } });
    return;
  }

  if (result.action === "redirect-after-login") {
    next({ path: result.path });
    return;
  }

  next();
});

export default router;
