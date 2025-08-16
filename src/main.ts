import { inject } from "@vercel/analytics";
import { createPinia } from "pinia";
import { createApp, effectScope, watch } from "vue";

import App from "@/App.vue";
import "@/assets/styles.css";
import router from "@/router";
import { useAuthStore } from "@/stores/auth";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

const authStore = useAuthStore();
await authStore.initAuth();

// Global auth watcher to redirect to login if logging out while on a protected route
const scope = effectScope();
scope.run(() => {
  watch(
    () => authStore.isAuthenticated,
    (isAuthenticated) => {
      if (!isAuthenticated && router.currentRoute.value.meta.requiresAuth) {
        const redirect = router.currentRoute.value.fullPath;
        router.replace({ name: "login", query: { redirect } });
      }
    }
  );
});

app.mount("#app");

inject({
  framework: "vue"
});
