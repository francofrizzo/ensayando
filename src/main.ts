import { inject } from "@vercel/analytics";
import { createPinia } from "pinia";
import { createApp } from "vue";

import App from "@/App.vue";
import "@/assets/styles.css";
import router from "@/router";
import { useAuthStore } from "@/stores/auth";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

const authStore = useAuthStore();
authStore.initAuth();

app.mount("#app");

inject({
  framework: "vue"
});
