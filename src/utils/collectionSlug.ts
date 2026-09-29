// Top-level routes: a collection with one of these addresses would be unreachable.
// Mirrors the collections_slug_not_reserved constraint in the database.
export const RESERVED_COLLECTION_SLUGS = [
  "login",
  "reset-password",
  "nueva-coleccion",
  "404",
  "api",
  "assets"
] as const;

/** The error to show for a collection address, or "" when it's valid. */
export function collectionSlugError(slug: string): string {
  if (!slug) return "La dirección no puede quedar vacía.";
  if (!/^[a-z0-9-]+$/.test(slug)) return "Solo letras minúsculas, números y guiones.";
  if ((RESERVED_COLLECTION_SLUGS as readonly string[]).includes(slug)) {
    return "Esa dirección está reservada. Probá con otra.";
  }
  return "";
}
