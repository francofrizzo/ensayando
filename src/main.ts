import { createPinia } from "pinia";
import { createApp } from "vue";

import App from "@/App.vue";
import "@/assets/styles.css";
import router from "@/router";

import { inject } from "@vercel/analytics";

const app = createApp(App);

app.use(createPinia());
app.use(router);

app.mount("#app");

inject({
  framework: "vue"
});
