// @vitest-environment node
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Hardening from the code review (migration 20260929120000_review_hardening.sql).
// Runs against a local Supabase only: SUPABASE_DB_TEST=1 pnpm test:db
const enabled = process.env.SUPABASE_DB_TEST === "1";
const url = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321";
const anonKey =
  process.env.SUPABASE_TEST_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const serviceKey =
  process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const run = randomUUID().slice(0, 8);
const PASSWORD = "test-password-123";
const options = { auth: { persistSession: false, autoRefreshToken: false } };

type Person = { id: string; client: SupabaseClient };

describe.skipIf(!enabled)("review hardening", () => {
  const service = createClient(url, serviceKey, options);
  const people: Record<string, Person> = {};
  const collectionIds: number[] = [];
  let collectionA = 0;
  let collectionB = 0;
  let songA = 0;
  let songB = 0;

  async function person(name: string, email: string, managedUsername?: string) {
    const { data, error } = await service.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      ...(managedUsername ? { app_metadata: { username: managedUsername } } : {})
    });
    if (error || !data.user) throw error ?? new Error("no user");
    const client = createClient(url, anonKey, options);
    const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (signIn.error) throw signIn.error;
    people[name] = { id: data.user.id, client };
  }

  async function member(name: string, collectionId: number, role: string) {
    const { error } = await service
      .from("user_collections")
      .insert({ user_id: people[name]!.id, collection_id: collectionId, role });
    if (error) throw error;
  }

  async function collection(slug: string, trackColors: object = {}): Promise<number> {
    const { data, error } = await service
      .from("collections")
      .insert({ slug, title: slug, hue: 300, track_colors: trackColors, visibility: "private" })
      .select("id")
      .single();
    if (error) throw error;
    collectionIds.push(data.id);
    return data.id;
  }

  async function song(collectionId: number, slug: string, lyrics: unknown = null): Promise<number> {
    const { data, error } = await service
      .from("songs")
      .insert({ collection_id: collectionId, slug, title: slug, lyrics })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  beforeAll(async () => {
    await person("admin", `h-admin-${run}@example.com`);
    await person("coAdmin", `h-coadmin-${run}@ensayando.com.ar`, `h-coadmin-${run}`);
    await person("appAdmin", `h-app-${run}@ensayando.com.ar`, `h-app-${run}`);
    await person("editor", `h-editor-${run}@example.com`);
    await person("managed", `h-managed-${run}@ensayando.com.ar`, `h-managed-${run}`);
    await person("spoofer", `h-spoofer-${run}@example.com`);
    await service.from("app_admins").insert({ user_id: people.appAdmin!.id });

    collectionA = await collection(`hard-a-${run}`, { sop: { hue: 350, intensity: "media" } });
    collectionB = await collection(`hard-b-${run}`);
    await member("admin", collectionA, "admin");
    await member("coAdmin", collectionA, "admin");
    await member("appAdmin", collectionA, "viewer");
    await member("editor", collectionA, "editor");
    await member("managed", collectionA, "viewer");
    await member("spoofer", collectionA, "viewer");
    songA = await song(collectionA, "uno", [[{ text: "hola", color_keys: ["sop"] }]]);
    songB = await song(collectionB, "otra");
  });

  afterAll(async () => {
    if (collectionIds.length) await service.from("collections").delete().in("id", collectionIds);
    for (const p of Object.values(people)) await service.auth.admin.deleteUser(p.id);
  });

  it("keeps co-admins and app admins out of reach of a collection admin's reset", async () => {
    const mode = async (who: string, target: string) =>
      (await people[who]!.client.rpc("account_reset_mode", { p_user_id: people[target]!.id }))
        .data;
    expect(await mode("admin", "coAdmin")).toBeNull();
    expect(await mode("admin", "appAdmin")).toBeNull();
    expect(await mode("admin", "managed")).toBe("password");
    expect(await mode("appAdmin", "coAdmin")).toBe("password");
    expect(await mode("coAdmin", "coAdmin")).toBe("password");
  });

  it("doesn't let an editor move songs or tracks into another collection", async () => {
    const moveSong = await people.editor!.client
      .from("songs")
      .update({ collection_id: collectionB })
      .eq("id", songA)
      .select("id");
    expect(moveSong.error ?? moveSong.data?.length === 0).toBeTruthy();

    const { data: track } = await service
      .from("audio_tracks")
      .insert({ song_id: songA, title: "Voz", audio_file_url: "x" })
      .select("id")
      .single();
    const moveTrack = await people.editor!.client
      .from("audio_tracks")
      .update({ song_id: songB })
      .eq("id", track!.id)
      .select("id");
    expect(moveTrack.error ?? moveTrack.data?.length === 0).toBeTruthy();

    const { data: stillThere } = await service.from("songs").select("collection_id").eq("id", songA).single();
    expect(stillThere!.collection_id).toBe(collectionA);

    const ownEdit = await people.editor!.client
      .from("songs")
      .update({ title: "Uno" })
      .eq("id", songA)
      .select("id");
    expect(ownEdit.data).toHaveLength(1);
  });

  it("limits collection updates to the editable columns", async () => {
    const createdBy = await people.admin!.client
      .from("collections")
      .update({ created_by: people.admin!.id })
      .eq("id", collectionA);
    expect(createdBy.error?.code).toBe("42501");

    const colors = await people.admin!.client
      .from("collections")
      .update({ hue: 10 })
      .eq("id", collectionA);
    expect(colors.error?.code).toBe("42501");

    const title = await people.admin!.client
      .from("collections")
      .update({ title: "Colección A" })
      .eq("id", collectionA)
      .select("id");
    expect(title.data).toHaveLength(1);
  });

  it("stops showing a private collection to its creator once removed", async () => {
    const { data, error } = await people.appAdmin!.client
      .from("collections")
      .insert({ slug: `hard-own-${run}`, title: "Propia", hue: 10, track_colors: {}, visibility: "private" })
      .select("id")
      .single();
    expect(error).toBeNull();
    collectionIds.push(data!.id);
    await member("admin", data!.id, "admin");
    const removed = await people.admin!.client.rpc("remove_member", {
      p_collection_id: data!.id,
      p_user_id: people.appAdmin!.id
    });
    expect(removed.error).toBeNull();

    const { data: visible } = await people.appAdmin!.client
      .from("collections")
      .select("id")
      .eq("id", data!.id);
    expect(visible).toEqual([]);
  });

  it("rejects reserved collection addresses", async () => {
    const { error } = await people.appAdmin!.client
      .from("collections")
      .insert({ slug: "login", title: "Login", hue: 10, track_colors: {}, visibility: "private" });
    expect(error?.message).toContain("collections_slug_not_reserved");
  });

  it("never lets two admins demote each other at the same time", async () => {
    const id = await collection(`hard-race-${run}`);
    await member("admin", id, "admin");
    await member("coAdmin", id, "admin");
    const results = await Promise.all([
      people.admin!.client.rpc("set_member_role", {
        p_collection_id: id,
        p_user_id: people.coAdmin!.id,
        p_role: "viewer"
      }),
      people.coAdmin!.client.rpc("set_member_role", {
        p_collection_id: id,
        p_user_id: people.admin!.id,
        p_role: "viewer"
      })
    ]);
    expect(results.some((r) => r.error)).toBe(true);
    const { data } = await service
      .from("user_collections")
      .select("id")
      .eq("collection_id", id)
      .eq("role", "admin");
    expect(data!.length).toBeGreaterThanOrEqual(1);
  });

  it("ignores usernames people set on themselves", async () => {
    await people.spoofer!.client.auth.updateUser({ data: { username: `h-managed-${run}` } });
    const found = await people.admin!.client.rpc("find_account", { p_query: `h-managed-${run}` });
    expect(found.data?.map((a: { user_id: string }) => a.user_id)).toEqual([people.managed!.id]);

    const members = await people.admin!.client.rpc("collection_members", {
      p_collection_id: collectionA
    });
    const byId = new Map(
      (members.data as { user_id: string; username: string }[]).map((m) => [m.user_id, m.username])
    );
    expect(byId.get(people.managed!.id)).toBe(`h-managed-${run}`);
    expect(byId.get(people.spoofer!.id)).toBe(`h-spoofer-${run}@example.com`);
  });

  it("validates palettes and keeps verses off removed colors", async () => {
    const call = (hue: number, trackColors: object, keyMap: object = {}) =>
      people.admin!.client.rpc("update_collection_palette", {
        p_collection_id: collectionA,
        p_hue: hue,
        p_intensity: "media",
        p_track_colors: trackColors,
        p_key_map: keyMap
      });

    expect((await call(400, { sop: { hue: 350, intensity: "media" } })).error?.message).toBe(
      "INVALID_PALETTE"
    );
    expect((await call(300, { sop: { hue: 350, intensity: "fuerte" } })).error?.message).toBe(
      "INVALID_PALETTE"
    );
    expect((await call(300, { sop: "#ff0000" })).error?.message).toBe("INVALID_PALETTE");
    // Only a verse uses "sop" (no track does).
    expect((await call(300, {})).error?.message).toBe("KEY_IN_USE_BY_LYRICS");

    const replaced = await call(
      300,
      { alt: { hue: 70, intensity: "suave" }, clic: { neutral: true } },
      { sop: "alt" }
    );
    expect(replaced.error).toBeNull();
    const { data } = await service.from("songs").select("lyrics").eq("id", songA).single();
    expect(data!.lyrics[0][0].color_keys).toEqual(["alt"]);
  });
});
