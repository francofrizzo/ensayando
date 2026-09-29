// @vitest-environment node
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createManagedAccount, resetPassword } from "../../server/admin/members";

// Account flows against a local Supabase (never a linked project):
//   SUPABASE_DB_TEST=1 pnpm test:db
const enabled = process.env.SUPABASE_DB_TEST === "1";
const url = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321";
const anonKey =
  process.env.SUPABASE_TEST_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const serviceKey =
  process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const run = randomUUID().slice(0, 8);
const options = { auth: { persistSession: false, autoRefreshToken: false } };

describe.skipIf(!enabled)("managed accounts", () => {
  const service = createClient(url, serviceKey, options);
  let admin: SupabaseClient;
  let adminId = "";
  let collectionId = 0;
  const createdUsers: string[] = [];

  async function signIn(email: string, password: string) {
    const client = createClient(url, anonKey, options);
    const { error } = await client.auth.signInWithPassword({ email, password });
    return { client, error };
  }

  beforeAll(async () => {
    const email = `admin-m-${run}@example.com`;
    const { data } = await service.auth.admin.createUser({
      email,
      password: "test-password-123",
      email_confirm: true
    });
    adminId = data.user!.id;
    createdUsers.push(adminId);
    const { data: collection } = await service
      .from("collections")
      .insert({ slug: `miembros-${run}`, title: "Miembros", hue: 300, track_colors: {}, visibility: "private" })
      .select("id")
      .single();
    collectionId = collection!.id;
    await service
      .from("user_collections")
      .insert({ user_id: adminId, collection_id: collectionId, role: "admin" });
    admin = (await signIn(email, "test-password-123")).client;
  });

  afterAll(async () => {
    await service.from("collections").delete().eq("id", collectionId);
    for (const id of createdUsers) await service.auth.admin.deleteUser(id);
  });

  it("creates a managed account that can sign in, then resets it", async () => {
    const username = `coro-${run}`;
    const created = await createManagedAccount(
      { user: admin, service },
      { collectionId, username, role: "viewer" }
    );
    createdUsers.push(created.userId);

    const first = await signIn(`${username}@ensayando.com.ar`, created.password);
    expect(first.error).toBeNull();
    const role = await first.client.rpc("collection_role", { p_collection_id: collectionId });
    expect(role.data).toBe("viewer");

    const reset = await resetPassword({ user: admin, service }, { userId: created.userId });
    expect(reset.kind).toBe("password");
    if (reset.kind !== "password") return;

    expect((await signIn(`${username}@ensayando.com.ar`, created.password)).error).not.toBeNull();
    expect((await signIn(`${username}@ensayando.com.ar`, reset.password)).error).toBeNull();
  });

  it("does not create the same username twice", async () => {
    const username = `repetido-${run}`;
    const created = await createManagedAccount(
      { user: admin, service },
      { collectionId, username, role: "viewer" }
    );
    createdUsers.push(created.userId);
    await expect(
      createManagedAccount({ user: admin, service }, { collectionId, username, role: "viewer" })
    ).rejects.toMatchObject({ status: 409 });
  });
});
