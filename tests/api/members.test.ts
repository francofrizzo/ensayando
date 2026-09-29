// @vitest-environment node
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  createManagedAccount,
  generatePassword,
  inviteMember,
  parseMembersRequest,
  resetPassword
} from "../../server/admin/members";
import { ApiError } from "../../server/http";

type Result = { data?: unknown; error?: { message?: string; code?: string; status?: number } | null };

function userClient(rpc: Record<string, Result>) {
  return {
    rpc: vi.fn(async (name: string) => ({ data: null, error: null, ...rpc[name] }))
  } as unknown as SupabaseClient;
}

function serviceClient(overrides: {
  createUser?: Result;
  inviteUserByEmail?: Result;
  getUserById?: Result;
  updateUserById?: Result;
  resetPasswordForEmail?: Result;
  insert?: Result;
}) {
  const insert = vi.fn(async () => ({ error: null, ...overrides.insert }));
  const admin = {
    createUser: vi.fn(async () => ({ error: null, ...overrides.createUser })),
    inviteUserByEmail: vi.fn(async () => ({ error: null, ...overrides.inviteUserByEmail })),
    getUserById: vi.fn(async () => ({ error: null, ...overrides.getUserById })),
    updateUserById: vi.fn(async () => ({ error: null, ...overrides.updateUserById })),
    deleteUser: vi.fn(async () => ({ error: null }))
  };
  const client = {
    from: vi.fn(() => ({ insert })),
    auth: {
      admin,
      resetPasswordForEmail: vi.fn(async () => ({ error: null, ...overrides.resetPasswordForEmail }))
    }
  };
  return { client: client as unknown as SupabaseClient, admin, insert, raw: client };
}

describe("members request parsing", () => {
  it("normalizes usernames and rejects invalid ones", () => {
    expect(
      parseMembersRequest({ action: "create-managed", collectionId: 3, username: " Lucia ", role: "viewer" })
    ).toEqual({ action: "create-managed", collectionId: 3, username: "lucia", role: "viewer" });
    expect(() =>
      parseMembersRequest({ action: "create-managed", collectionId: 3, username: "a@b", role: "viewer" })
    ).toThrow(ApiError);
    expect(() =>
      parseMembersRequest({ action: "create-managed", collectionId: 3, username: "lu", role: "viewer" })
    ).toThrow("entre 3 y 32");
  });

  it("rejects unknown roles, managed-domain invitations and bad ids", () => {
    expect(() =>
      parseMembersRequest({ action: "invite", collectionId: 3, email: "a@b.com", role: "owner" })
    ).toThrow("Ese rol no existe.");
    expect(() =>
      parseMembersRequest({ action: "invite", collectionId: 3, email: "x@ensayando.com.ar", role: "viewer" })
    ).toThrow("Ese email no es válido.");
    expect(() => parseMembersRequest({ action: "reset-password", userId: "1" })).toThrow(
      "Cuenta inválida"
    );
    expect(() => parseMembersRequest({ action: "drop-table" })).toThrow("Acción inválida");
  });

  it("generates readable temporary passwords", () => {
    expect(generatePassword()).toMatch(/^[a-hj-km-np-z2-9]{4}-[a-hj-km-np-z2-9]{4}-[a-hj-km-np-z2-9]{4}$/);
  });
});

describe("createManagedAccount", () => {
  const input = { collectionId: 7, username: "lucia", role: "editor" };

  it("creates the account, binds it and returns the password once", async () => {
    const service = serviceClient({ createUser: { data: { user: { id: "u-1" } } } });
    const result = await createManagedAccount(
      { user: userClient({ is_collection_admin: { data: true } }), service: service.client, generatePassword: () => "abcd-efgh-jkmn" },
      input
    );
    expect(result).toEqual({ userId: "u-1", username: "lucia", password: "abcd-efgh-jkmn" });
    expect(service.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "lucia@ensayando.com.ar", email_confirm: true })
    );
    expect(service.insert).toHaveBeenCalledWith({ user_id: "u-1", collection_id: 7, role: "editor" });
  });

  it("refuses when the caller is not an admin of the collection", async () => {
    const service = serviceClient({});
    await expect(
      createManagedAccount({ user: userClient({ is_collection_admin: { data: false } }), service: service.client }, input)
    ).rejects.toMatchObject({ status: 403 });
    expect(service.admin.createUser).not.toHaveBeenCalled();
  });

  it("explains when the username is taken", async () => {
    const service = serviceClient({ createUser: { data: { user: null }, error: { code: "email_exists", status: 422 } } });
    await expect(
      createManagedAccount({ user: userClient({ is_collection_admin: { data: true } }), service: service.client }, input)
    ).rejects.toMatchObject({ status: 409 });
  });

  it("removes the new account if the membership can't be saved", async () => {
    const service = serviceClient({
      createUser: { data: { user: { id: "u-2" } } },
      insert: { error: { message: "boom" } }
    });
    await expect(
      createManagedAccount({ user: userClient({ is_collection_admin: { data: true } }), service: service.client }, input)
    ).rejects.toBeInstanceOf(ApiError);
    expect(service.admin.deleteUser).toHaveBeenCalledWith("u-2");
  });
});

describe("inviteMember", () => {
  it("invites with the reset-password redirect and binds the account", async () => {
    const service = serviceClient({ inviteUserByEmail: { data: { user: { id: "u-3" } } } });
    const result = await inviteMember(
      {
        user: userClient({ is_collection_admin: { data: true } }),
        service: service.client,
        redirectTo: "https://ensayando.example/reset-password"
      },
      { collectionId: 7, email: "sofia@example.com", role: "viewer" }
    );
    expect(result).toEqual({ userId: "u-3", email: "sofia@example.com" });
    expect(service.admin.inviteUserByEmail).toHaveBeenCalledWith("sofia@example.com", {
      data: { username: "sofia@example.com" },
      redirectTo: "https://ensayando.example/reset-password"
    });
  });
});

describe("resetPassword", () => {
  const userId = "4f1c2d3e-0000-4000-8000-000000000000";

  it("sets a temporary password for managed accounts", async () => {
    const service = serviceClient({ getUserById: { data: { user: { email: "lucia@ensayando.com.ar" } } } });
    const result = await resetPassword(
      { user: userClient({ account_reset_mode: { data: "password" } }), service: service.client, generatePassword: () => "pppp-qqqq-rrrr" },
      { userId }
    );
    expect(result).toEqual({ kind: "password", password: "pppp-qqqq-rrrr" });
    expect(service.admin.updateUserById).toHaveBeenCalledWith(userId, { password: "pppp-qqqq-rrrr" });
  });

  it("sends a recovery email for accounts with a real email", async () => {
    const service = serviceClient({ getUserById: { data: { user: { email: "sofia@example.com" } } } });
    const result = await resetPassword(
      { user: userClient({ account_reset_mode: { data: "email" } }), service: service.client, redirectTo: "https://x/reset-password" },
      { userId }
    );
    expect(result).toEqual({ kind: "email", email: "sofia@example.com" });
    expect(service.raw.auth.resetPasswordForEmail).toHaveBeenCalledWith("sofia@example.com", {
      redirectTo: "https://x/reset-password"
    });
    expect(service.admin.updateUserById).not.toHaveBeenCalled();
  });

  it("refuses when the database says the caller can't", async () => {
    const service = serviceClient({});
    await expect(
      resetPassword({ user: userClient({ account_reset_mode: { data: null } }), service: service.client }, { userId })
    ).rejects.toMatchObject({ status: 403 });
    expect(service.admin.getUserById).not.toHaveBeenCalled();
  });
});
