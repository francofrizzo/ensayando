import { createRouter, createWebHistory } from "vue-router";
import PlayerView from "../views/PlayerView.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: PlayerView
    },
    {
      path: "/:collectionSlug",
      name: "collection",
      component: PlayerView,
      props: true
    },
    {
      path: "/:collectionSlug/:songSlug",
      name: "song",
      component: PlayerView,
      props: true
    }
  ]
});

export default router;
