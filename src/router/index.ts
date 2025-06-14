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
      path: "/:collectionId",
      name: "collection",
      component: PlayerView,
      props: true
    },
    {
      path: "/:collectionId/:songId",
      name: "song",
      component: PlayerView,
      props: true
    }
  ]
});

export default router;
