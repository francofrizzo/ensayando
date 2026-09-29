// @vitest-environment node
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Runs against a local Supabase (`npx supabase start`), never a linked project.
//   SUPABASE_DB_TEST=1 pnpm test:db
// SUPABASE_TEST_URL defaults to the standard local API port.
const enabled = process.env.SUPABASE_DB_TEST === "1";
const url = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321";
// Deterministic keys of every local Supabase instance.
const anonKey =
  process.env.SUPABASE_TEST_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const serviceKey =
  process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const run = randomUUID().slice(0, 8);
const PASSWORD = "test-password-123";
const options = { auth: { persistSession: false, autoRefreshToken: false } };

type Person = { id: string; email: string; client: SupabaseClient };

describe.skipIf(!enabled)("database permissions", () => {
  const service = createClient(url, serviceKey, options);
  const people: Record<string, Person> = {};
  const collectionIds: number[] = [];
  let collectionA = 0;
  let collectionB = 0;
  const songIds: number[] = [];

  async function person(name: string, email: string): Promise<Person> {
    const { data, error } = await service.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { username: email.endsWith("@ensayando.com.ar") ? email.split("@")[0] : email }
    });
    if (error || !data.user) throw error ?? new Error("no user");
    const client = createClient(url, anonKey, options);
    const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (signIn.error) throw signIn.error;
    const created = { id: data.user.id, email, client };
    people[name] = created;
    return created;
  }

  async function member(personName: string, collectionId: number, role: string) {
    const { error } = await service
      .from("user_collections")
      .insert({ user_id: people[personName]!.id, collection_id: collectionId, role });
    if (error) throw error;
  }

  async function collection(title: string): Promise<number> {
    const { data, error } = await service
      .from("collections")
      .insert({ slug: `${title}-${run}`, title, hue: 300, track_colors: {}, visibility: "private" })
      .select("id")
      .single();
    if (error) throw error;
    collectionIds.push(data.id);
    return data.id;
  }

  beforeAll(async () => {
    await person("admin", `admin-${run}@example.com`);
    await person("editor", `editor-${run}@example.com`);
    await person("viewer", `viewer-${run}@example.com`);
    await person("managedOnlyA", `solo-a-${run}@ensayando.com.ar`);
    await person("managedAB", `a-y-b-${run}@ensayando.com.ar`);
    await person("appAdmin", `app-${run}@example.com`);
    await person("otherAdmin", `other-${run}@example.com`);
    await service.from("app_admins").insert({ user_id: people.appAdmin!.id });

    collectionA = await collection("coleccion-a");
    collectionB = await collection("coleccion-b");
    await member("admin", collectionA, "admin");
    await member("editor", collectionA, "editor");
    await member("viewer", collectionA, "viewer");
    await member("managedOnlyA", collectionA, "viewer");
    await member("managedAB", collectionA, "viewer");
    await member("managedAB", collectionB, "viewer");
    await member("otherAdmin", collectionB, "admin");

    for (const slug of ["uno", "dos", "tres"]) {
      const { data, error } = await service
        .from("songs")
        .insert({ collection_id: collectionA, slug, title: slug })
        .select("id")
        .single();
      if (error) throw error;
      songIds.push(data.id);
    }
    await service.from("audio_tracks").insert(
      songIds.map((songId) => ({ song_id: songId, title: "Voz", audio_file_url: "x" }))
    );
  });

  afterAll(async () => {
    if (collectionIds.length) await service.from("collections").delete().in("id", collectionIds);
    for (const p of Object.values(people)) await service.auth.admin.deleteUser(p.id);
  });

  it("does not let an editor change roles or reorder songs", async () => {
    const role = await people.editor!.client.rpc("set_member_role", {
      p_collection_id: collectionA,
      p_user_id: people.viewer!.id,
      p_role: "editor"
    });
    expect(role.error?.message).toBe("FORBIDDEN");

    const order = await people.editor!.client.rpc("reorder_songs", {
      p_collection_id: collectionA,
      p_song_ids: [...songIds].reverse()
    });
    expect(order.error?.message).toBe("FORBIDDEN");
  });

  it("lets an admin reorder songs and rejects incomplete orders", async () => {
    const reversed = [...songIds].reverse();
    const ok = await people.admin!.client.rpc("reorder_songs", {
      p_collection_id: collectionA,
      p_song_ids: reversed
    });
    expect(ok.error).toBeNull();
    const { data } = await service
      .from("songs")
      .select("id, order")
      .eq("collection_id", collectionA)
      .order("order");
    expect(data?.map((s) => s.id)).toEqual(reversed);

    const partial = await people.admin!.client.rpc("reorder_songs", {
      p_collection_id: collectionA,
      p_song_ids: reversed.slice(1)
    });
    expect(partial.error?.message).toBe("INVALID_ORDER");
  });

  it("never leaves a collection without an admin", async () => {
    const demote = await people.admin!.client.rpc("set_member_role", {
      p_collection_id: collectionA,
      p_user_id: people.admin!.id,
      p_role: "editor"
    });
    expect(demote.error?.message).toBe("LAST_ADMIN");

    const leave = await people.admin!.client.rpc("remove_member", {
      p_collection_id: collectionA,
      p_user_id: people.admin!.id
    });
    expect(leave.error?.message).toBe("LAST_ADMIN");

    // With a second admin, the first one can step down.
    expect(
      (
        await people.admin!.client.rpc("set_member_role", {
          p_collection_id: collectionA,
          p_user_id: people.editor!.id,
          p_role: "admin"
        })
      ).error
    ).toBeNull();
    expect(
      (
        await people.editor!.client.rpc("set_member_role", {
          p_collection_id: collectionA,
          p_user_id: people.editor!.id,
          p_role: "editor"
        })
      ).error
    ).toBeNull();
  });

  it("lists members only for admins, with account details", async () => {
    const { data, error } = await people.admin!.client.rpc("collection_members", {
      p_collection_id: collectionA
    });
    expect(error).toBeNull();
    const managed = data?.find((m: { user_id: string }) => m.user_id === people.managedOnlyA!.id);
    expect(managed).toMatchObject({ is_managed: true, role: "viewer", username: `solo-a-${run}` });
    expect(data?.[0]?.role).toBe("admin");

    const denied = await people.viewer!.client.rpc("collection_members", {
      p_collection_id: collectionA
    });
    expect(denied.error?.message).toBe("FORBIDDEN");
  });

  it("adds existing people and rejects duplicates and bad roles", async () => {
    const add = await people.admin!.client.rpc("add_member", {
      p_collection_id: collectionA,
      p_user_id: people.otherAdmin!.id,
      p_role: "viewer"
    });
    expect(add.error).toBeNull();
    const again = await people.admin!.client.rpc("add_member", {
      p_collection_id: collectionA,
      p_user_id: people.otherAdmin!.id,
      p_role: "viewer"
    });
    expect(again.error?.message).toBe("ALREADY_MEMBER");
    const bad = await people.admin!.client.rpc("set_member_role", {
      p_collection_id: collectionA,
      p_user_id: people.otherAdmin!.id,
      p_role: "owner"
    });
    expect(bad.error?.message).toBe("INVALID_ROLE");
    const removed = await people.admin!.client.rpc("remove_member", {
      p_collection_id: collectionA,
      p_user_id: people.otherAdmin!.id
    });
    expect(removed.error).toBeNull();
  });

  it("blocks direct writes to memberships", async () => {
    const { error } = await people.admin!.client
      .from("user_collections")
      .insert({ user_id: people.otherAdmin!.id, collection_id: collectionA, role: "admin" });
    expect(error).not.toBeNull();
  });

  it("finds accounts only by exact match and only for admins", async () => {
    const byUser = await people.admin!.client.rpc("find_account", {
      p_query: `solo-a-${run}`
    });
    expect(byUser.data?.map((a: { user_id: string }) => a.user_id)).toEqual([
      people.managedOnlyA!.id
    ]);
    const partial = await people.admin!.client.rpc("find_account", { p_query: "solo-a" });
    expect(partial.data).toEqual([]);
    const denied = await people.viewer!.client.rpc("find_account", {
      p_query: `solo-a-${run}`
    });
    expect(denied.error?.message).toBe("FORBIDDEN");
  });

  it("decides how each account can be reset", async () => {
    const mode = async (who: string, target: string) =>
      (await people[who]!.client.rpc("account_reset_mode", { p_user_id: people[target]!.id }))
        .data;
    expect(await mode("admin", "managedOnlyA")).toBe("password");
    // Also in a collection this admin doesn't run: only app admins.
    expect(await mode("admin", "managedAB")).toBeNull();
    expect(await mode("appAdmin", "managedAB")).toBe("password");
    expect(await mode("admin", "viewer")).toBe("email");
    expect(await mode("editor", "managedOnlyA")).toBeNull();
  });

  it("rejects reserved and duplicated song slugs", async () => {
    for (const slug of ["nueva", "ajustes", "editar"]) {
      const { error } = await people.editor!.client
        .from("songs")
        .insert({ collection_id: collectionA, slug, title: slug });
      expect(error?.message).toContain("songs_slug_not_reserved");
    }
    const { error } = await people.editor!.client
      .from("songs")
      .insert({ collection_id: collectionA, slug: "uno", title: "Uno otra vez" });
    expect(error?.code).toBe("23505");
  });

  it("lets editors remove tracks but only admins delete songs, with cascade", async () => {
    const [first, second] = songIds;
    const { data: tracks } = await service.from("audio_tracks").select("id").eq("song_id", first!);
    const removeTrack = await people.editor!.client
      .from("audio_tracks")
      .delete()
      .eq("id", tracks![0]!.id)
      .select("id");
    expect(removeTrack.data).toHaveLength(1);

    const editorDelete = await people.editor!.client
      .from("songs")
      .delete()
      .eq("id", second!)
      .select("id");
    expect(editorDelete.data).toEqual([]);

    const adminDelete = await people.admin!.client
      .from("songs")
      .delete()
      .eq("id", second!)
      .select("id");
    expect(adminDelete.data).toHaveLength(1);
    const { data: orphanTracks } = await service
      .from("audio_tracks")
      .select("id")
      .eq("song_id", second!);
    expect(orphanTracks).toEqual([]);
  });

  it("lets app admins create collections and makes them admin", async () => {
    const denied = await people.admin!.client
      .from("collections")
      .insert({ slug: `nope-${run}`, title: "No", hue: 300, track_colors: {}, visibility: "private" });
    expect(denied.error).not.toBeNull();

    const { data, error } = await people.appAdmin!.client
      .from("collections")
      .insert({ slug: `nueva-${run}`, title: "Nueva", hue: 300, track_colors: {}, visibility: "private" })
      .select("id")
      .single();
    expect(error).toBeNull();
    collectionIds.push(data!.id);
    const role = await people.appAdmin!.client.rpc("collection_role", {
      p_collection_id: data!.id
    });
    expect(role.data).toBe("admin");
  });

  it("deletes a collection with its songs and memberships", async () => {
    const editorDelete = await people.editor!.client
      .from("collections")
      .delete()
      .eq("id", collectionA)
      .select("id");
    expect(editorDelete.data).toEqual([]);

    const { data, error } = await people.admin!.client
      .from("collections")
      .delete()
      .eq("id", collectionA)
      .select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    const songs = await service.from("songs").select("id").eq("collection_id", collectionA);
    const members = await service
      .from("user_collections")
      .select("id")
      .eq("collection_id", collectionA);
    expect(songs.data).toEqual([]);
    expect(members.data).toEqual([]);
  });

  it("lets the account of a sole admin be deleted", async () => {
    const { error } = await service.auth.admin.deleteUser(people.otherAdmin!.id);
    expect(error).toBeNull();
    delete people.otherAdmin;
  });
});
