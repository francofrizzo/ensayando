import { watch } from "vue";
import { createRouter, createWebHistory } from "vue-router";

import { useAuthStore } from "@/stores/auth";

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
      path: "/:collectionSlug",
      name: "collection",
      component: () => import("@/views/CollectionView.vue"),
      props: true,
      meta: {
        requiresAuth: true
      }
    },
    {
      path: "/:collectionSlug/:songSlug",
      name: "song",
      component: () => import("@/views/SongView.vue"),
      props: true,
      meta: {
        requiresAuth: true
      }
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

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: "login", query: { redirect: to.fullPath } });
    return;
  }

  if (to.name === "login" && authStore.isAuthenticated) {
    next({ path: (to.query.redirect as string) || "/" });
    return;
  }

  next();
});

export default router;
