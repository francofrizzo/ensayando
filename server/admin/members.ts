import type { SupabaseClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";

import { ApiError, databaseError } from "../http.js";

// Accounts without a real inbox log in with "<username>@ensayando.com.ar"
// (see EMAIL_DOMAIN in src/stores/auth.ts).
export const MANAGED_EMAIL_DOMAIN = "ensayando.com.ar";
const ROLES = new Set(["admin", "editor", "viewer"]);
const USERNAME = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// No 0/o, 1/l/i: temporary passwords get read aloud and typed on phones.
const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export type MembersDeps = {
  // Acts as the caller (their token): permission checks go through RLS and RPCs.
  user: SupabaseClient;
  // Service role: auth admin operations, used only after the check passed.
  service: SupabaseClient;
  generatePassword?: () => string;
  // Where recovery and invitation emails send people back (…/reset-password).
  redirectTo?: string;
};

export type MembersRequest =
  | { action: "create-managed"; collectionId: number; username: string; role: string }
  | { action: "invite"; collectionId: number; email: string; role: string }
  | { action: "reset-password"; userId: string };

export type CreatedManagedAccount = { userId: string; username: string; password: string };
export type InvitedMember = { userId: string; email: string };
export type PasswordReset =
  | { kind: "password"; password: string }
  | { kind: "email"; email: string };

export function generatePassword(): string {
  const group = () =>
    Array.from({ length: 4 }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]).join(
      ""
    );
  return `${group()}-${group()}-${group()}`;
}

export function parseMembersRequest(body: Record<string, unknown>): MembersRequest {
  const role = typeof body.role === "string" ? body.role : "";
  const collectionId = body.collectionId;

  if (body.action === "create-managed" || body.action === "invite") {
    if (!Number.isSafeInteger(collectionId) || (collectionId as number) <= 0) {
      throw new ApiError(400, "Colección inválida");
    }
    if (!ROLES.has(role)) throw new ApiError(400, "Ese rol no existe.");
  }

  if (body.action === "create-managed") {
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    if (!USERNAME.test(username)) {
      throw new ApiError(
        400,
        "El usuario tiene que tener entre 3 y 32 caracteres: letras, números, punto, guion o guion bajo."
      );
    }
    return { action: "create-managed", collectionId: collectionId as number, username, role };
  }

  if (body.action === "invite") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!EMAIL.test(email) || email.endsWith(`@${MANAGED_EMAIL_DOMAIN}`)) {
      throw new ApiError(400, "Ese email no es válido.");
    }
    return { action: "invite", collectionId: collectionId as number, email, role };
  }

  if (body.action === "reset-password") {
    const userId = typeof body.userId === "string" ? body.userId : "";
    if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new ApiError(400, "Cuenta inválida");
    return { action: "reset-password", userId };
  }

  throw new ApiError(400, "Acción inválida");
}

async function requireCollectionAdmin(user: SupabaseClient, collectionId: number): Promise<void> {
  const { data, error } = await user.rpc("is_collection_admin", { p_collection_id: collectionId });
  if (error) throw databaseError(error);
  if (data !== true) throw new ApiError(403, "No tenés permiso para hacer esto.");
}

function isExistingAccountError(error: { code?: string; status?: number; message?: string }) {
  return (
    error.code === "email_exists" ||
    error.code === "user_already_exists" ||
    error.status === 422 ||
    /already (been )?registered|already exists/i.test(error.message ?? "")
  );
}

// Adds the membership with the service client; if that fails, removes the account we
// just created so no orphan account is left behind.
async function bindToCollection(
  service: SupabaseClient,
  userId: string,
  collectionId: number,
  role: string
): Promise<void> {
  const { error } = await service
    .from("user_collections")
    .insert({ user_id: userId, collection_id: collectionId, role });
  if (error) {
    await service.auth.admin.deleteUser(userId);
    throw databaseError(error);
  }
}

export async function createManagedAccount(
  deps: MembersDeps,
  input: { collectionId: number; username: string; role: string }
): Promise<CreatedManagedAccount> {
  await requireCollectionAdmin(deps.user, input.collectionId);
  const password = (deps.generatePassword ?? generatePassword)();
  const { data, error } = await deps.service.auth.admin.createUser({
    email: `${input.username}@${MANAGED_EMAIL_DOMAIN}`,
    password,
    email_confirm: true,
    user_metadata: { username: input.username }
  });
  if (error || !data.user) {
    if (error && isExistingAccountError(error)) {
      throw new ApiError(409, "Ese usuario ya existe. Buscalo para sumarlo a la colección.");
    }
    throw new ApiError(500, "No se pudo crear la cuenta. Probá de nuevo.");
  }
  await bindToCollection(deps.service, data.user.id, input.collectionId, input.role);
  return { userId: data.user.id, username: input.username, password };
}

export async function inviteMember(
  deps: MembersDeps,
  input: { collectionId: number; email: string; role: string }
): Promise<InvitedMember> {
  await requireCollectionAdmin(deps.user, input.collectionId);
  const { data, error } = await deps.service.auth.admin.inviteUserByEmail(input.email, {
    data: { username: input.email },
    redirectTo: deps.redirectTo
  });
  if (error || !data.user) {
    if (error && isExistingAccountError(error)) {
      throw new ApiError(409, "Esa persona ya tiene cuenta. Buscala para sumarla a la colección.");
    }
    throw new ApiError(500, "No se pudo mandar la invitación. Probá de nuevo.");
  }
  await bindToCollection(deps.service, data.user.id, input.collectionId, input.role);
  return { userId: data.user.id, email: input.email };
}

export async function resetPassword(
  deps: MembersDeps,
  input: { userId: string }
): Promise<PasswordReset> {
  const { data: mode, error } = await deps.user.rpc("account_reset_mode", {
    p_user_id: input.userId
  });
  if (error) throw databaseError(error);
  if (mode !== "password" && mode !== "email") {
    throw new ApiError(403, "No podés restablecer la contraseña de esta cuenta.");
  }

  const { data, error: userError } = await deps.service.auth.admin.getUserById(input.userId);
  const email = data?.user?.email;
  if (userError || !email) throw new ApiError(404, "No encontramos esa cuenta.");

  if (mode === "password") {
    const password = (deps.generatePassword ?? generatePassword)();
    const { error: updateError } = await deps.service.auth.admin.updateUserById(input.userId, {
      password
    });
    if (updateError) throw new ApiError(500, "No se pudo cambiar la contraseña. Probá de nuevo.");
    return { kind: "password", password };
  }

  const { error: mailError } = await deps.service.auth.resetPasswordForEmail(email, {
    redirectTo: deps.redirectTo
  });
  if (mailError) throw new ApiError(500, "No se pudo mandar el email. Probá de nuevo.");
  return { kind: "email", email };
}

export async function handleMembersRequest(
  deps: MembersDeps,
  request: MembersRequest
): Promise<CreatedManagedAccount | InvitedMember | PasswordReset> {
  if (request.action === "create-managed") return await createManagedAccount(deps, request);
  if (request.action === "invite") return await inviteMember(deps, request);
  return await resetPassword(deps, request);
}
