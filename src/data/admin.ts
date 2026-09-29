// Collection settings and administration: members, roles, song order, collection
// CRUD and deletions. Permission checks live in the database (RLS + RPCs, see the
// phase 3 migrations) and in /api/members and /api/content for operations that need
// the service role or R2.
import type {
  AccountMatch,
  Collection,
  CollectionMember,
  CollectionRole,
  CreatedManagedAccount,
  DeletionResult,
  InvitedMember,
  PasswordReset
} from "@/data/types";
import { supabase } from "@/lib/supabaseClient";

// Codes raised by the database functions, in the words the UI shows.
const ADMIN_ERRORS: Record<string, string> = {
  FORBIDDEN: "No tenés permiso para hacer esto.",
  NOT_FOUND: "No encontramos lo que buscabas.",
  LAST_ADMIN: "La colección tiene que tener al menos un admin.",
  ALREADY_MEMBER: "Esa persona ya está en la colección.",
  INVALID_ROLE: "Ese rol no existe.",
  INVALID_ORDER: "El orden tiene que incluir cada canción de la colección una sola vez."
};

export class AdminError extends Error {}

export function adminErrorMessage(error: { message?: string; code?: string } | null): string {
  if (!error) return "";
  if (error.message && ADMIN_ERRORS[error.message]) return ADMIN_ERRORS[error.message]!;
  if (error.code === "23505") return "Esa dirección ya está en uso.";
  if (error.code === "23514" && error.message?.includes("songs_slug_not_reserved")) {
    return "Esa dirección está reservada. Probá con otra.";
  }
  if (error.code === "42501") return ADMIN_ERRORS.FORBIDDEN!;
  return "Algo falló. Probá de nuevo.";
}

function check<T>(response: { data: T; error: { message?: string; code?: string } | null }): T {
  if (response.error) throw new AdminError(adminErrorMessage(response.error));
  return response.data;
}

function checkRow<T>(response: {
  data: T | null;
  error: { message?: string; code?: string } | null;
}): T {
  const row = check(response);
  if (row === null) throw new AdminError(ADMIN_ERRORS.FORBIDDEN!);
  return row;
}

async function apiRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const {
    data: { session }
  } = await supabase.auth.getSession();
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) {
    throw new AdminError(payload?.error || "Algo falló. Probá de nuevo.");
  }
  return payload as T;
}

// ---------- who am I ----------

export async function fetchIsAppAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_app_admin");
  if (error) return false;
  return data === true;
}

// ---------- members ----------

export async function fetchCollectionMembers(collectionId: number): Promise<CollectionMember[]> {
  return check(await supabase.rpc("collection_members", { p_collection_id: collectionId })) ?? [];
}

export async function findAccount(query: string): Promise<AccountMatch[]> {
  return check(await supabase.rpc("find_account", { p_query: query })) ?? [];
}

export async function addMember(
  collectionId: number,
  userId: string,
  role: CollectionRole
): Promise<void> {
  check(
    await supabase.rpc("add_member", {
      p_collection_id: collectionId,
      p_user_id: userId,
      p_role: role
    })
  );
}

export async function setMemberRole(
  collectionId: number,
  userId: string,
  role: CollectionRole
): Promise<void> {
  check(
    await supabase.rpc("set_member_role", {
      p_collection_id: collectionId,
      p_user_id: userId,
      p_role: role
    })
  );
}

export async function removeMember(collectionId: number, userId: string): Promise<void> {
  check(
    await supabase.rpc("remove_member", { p_collection_id: collectionId, p_user_id: userId })
  );
}

// Username-only account bound to the collection. The password comes back once: show it
// and let the admin copy it.
export async function createManagedAccount(
  collectionId: number,
  username: string,
  role: CollectionRole
): Promise<CreatedManagedAccount> {
  return await apiRequest("/api/members", {
    action: "create-managed",
    collectionId,
    username,
    role
  });
}

export async function inviteMember(
  collectionId: number,
  email: string,
  role: CollectionRole
): Promise<InvitedMember> {
  return await apiRequest("/api/members", { action: "invite", collectionId, email, role });
}

// Managed accounts get a new temporary password; accounts with a real email get a
// recovery email.
export async function resetAccountPassword(userId: string): Promise<PasswordReset> {
  return await apiRequest("/api/members", { action: "reset-password", userId });
}

// ---------- songs ----------

export async function reorderSongs(collectionId: number, songIds: number[]): Promise<void> {
  check(
    await supabase.rpc("reorder_songs", { p_collection_id: collectionId, p_song_ids: songIds })
  );
}

export async function deleteSong(songId: number): Promise<DeletionResult> {
  return await apiRequest("/api/content", { action: "delete-song", songId });
}

// ---------- collections ----------

export type CollectionInsert = Pick<Collection, "slug" | "title" | "visibility" | "hue"> &
  Partial<Omit<Collection, "id" | "created_at" | "created_by" | "slug" | "title" | "visibility" | "hue">>;

// App admins only; the creator becomes the collection's admin.
export async function createCollection(values: CollectionInsert): Promise<Collection> {
  return checkRow(await supabase.from("collections").insert(values).select("*").single());
}

export async function updateCollection(
  collectionId: number,
  updates: Partial<Omit<Collection, "id" | "created_at" | "created_by">>
): Promise<Collection> {
  return checkRow(
    await supabase.from("collections").update(updates).eq("id", collectionId).select("*").single()
  );
}

export async function deleteCollection(collectionId: number): Promise<DeletionResult> {
  return await apiRequest("/api/content", { action: "delete-collection", collectionId });
}
