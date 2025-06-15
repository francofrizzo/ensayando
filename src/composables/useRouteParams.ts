import { computed } from "vue";
import { useRoute } from "vue-router";

export function useRouteParams() {
  const route = useRoute();

  const collectionSlug = computed(() => route.params.collectionSlug as string | undefined);

  const songSlug = computed(() => route.params.songSlug as string | undefined);

  return {
    collectionSlug,
    songSlug
  };
}
