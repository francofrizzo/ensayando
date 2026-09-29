// @vitest-environment node
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// update_collection_palette against a local Supabase (`npx supabase start`).
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
const PASSWORD = "test-password-123";
const options = { auth: { persistSession: false, autoRefreshToken: false } };

describe.skipIf(!enabled)("update_collection_palette", () => {
  const service = createClient(url, serviceKey, options);
  const userIds: string[] = [];
  let admin: SupabaseClient;
  let editor: SupabaseClient;
  let collectionId = 0;
  let songId = 0;

  async function signedIn(email: string, role: string): Promise<SupabaseClient> {
    const { data, error } = await service.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true
    });
    if (error || !data.user) throw error ?? new Error("no user");
    userIds.push(data.user.id);
    await service
      .from("user_collections")
      .insert({ user_id: data.user.id, collection_id: collectionId, role });
    const client = createClient(url, anonKey, options);
    const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (signIn.error) throw signIn.error;
    return client;
  }

  beforeAll(async () => {
    const { data, error } = await service
      .from("collections")
      .insert({
        slug: `paleta-${run}`,
        title: "Paleta",
        hue: 300,
        track_colors: {
          sop: { hue: 350, intensity: "media" },
          alt: { hue: 70, intensity: "media" },
          ten: { hue: 195, intensity: "media" }
        },
        visibility: "private"
      })
      .select("id")
      .single();
    if (error) throw error;
    collectionId = data.id;

    const song = await service
      .from("songs")
      .insert({
        collection_id: collectionId,
        slug: "vidala",
        title: "Vidala",
        lyrics: [
          [
            { text: "uno", color_keys: ["sop", "alt"] },
            [[{ text: "dos", color_keys: ["alt"] }], [{ text: "tres", color_keys: ["ten"] }]]
          ]
        ]
      })
      .select("id")
      .single();
    if (song.error) throw song.error;
    songId = song.data.id;
    await service.from("audio_tracks").insert([
      { song_id: songId, title: "Soprano", audio_file_url: "x", color_key: "sop" },
      { song_id: songId, title: "Contralto", audio_file_url: "x", color_key: "alt" },
      { song_id: songId, title: "Tenor", audio_file_url: "x", color_key: "ten" }
    ]);

    admin = await signedIn(`paleta-admin-${run}@example.com`, "admin");
    editor = await signedIn(`paleta-editor-${run}@example.com`, "editor");
  });

  afterAll(async () => {
    if (collectionId) await service.from("collections").delete().eq("id", collectionId);
    for (const id of userIds) await service.auth.admin.deleteUser(id);
  });

  it("is only for collection admins", async () => {
    const { error } = await editor.rpc("update_collection_palette", {
      p_collection_id: collectionId,
      p_hue: 10,
      p_intensity: "media",
      p_track_colors: {},
      p_key_map: {}
    });
    expect(error?.message).toBe("FORBIDDEN");
  });

  it("refuses to leave tracks on a removed key", async () => {
    const { error } = await admin.rpc("update_collection_palette", {
      p_collection_id: collectionId,
      p_hue: 300,
      p_intensity: "media",
      p_track_colors: { sop: { hue: 350, intensity: "media" } },
      p_key_map: {}
    });
    expect(error?.message).toBe("KEY_IN_USE");
    const { data } = await service.from("collections").select("track_colors").eq("id", collectionId).single();
    expect(Object.keys(data!.track_colors)).toEqual(expect.arrayContaining(["sop", "alt", "ten"]));
  });

  it("renames and replaces keys in tracks and lyrics in one go", async () => {
    const { error } = await admin.rpc("update_collection_palette", {
      p_collection_id: collectionId,
      p_hue: 48,
      p_intensity: "intensa",
      p_track_colors: {
        sop: { hue: 350, intensity: "media" },
        con: { hue: 70, intensity: "suave" }
      },
      // alt renamed to con; ten removed and replaced by sop
      p_key_map: { alt: "con", ten: "sop" }
    });
    expect(error).toBeNull();

    const collection = await service
      .from("collections")
      .select("hue, intensity, track_colors")
      .eq("id", collectionId)
      .single();
    expect(collection.data).toMatchObject({ hue: 48, intensity: "intensa" });

    const tracks = await service
      .from("audio_tracks")
      .select("title, color_key")
      .eq("song_id", songId)
      .order("title");
    expect(tracks.data).toEqual([
      { title: "Contralto", color_key: "con" },
      { title: "Soprano", color_key: "sop" },
      { title: "Tenor", color_key: "sop" }
    ]);

    const song = await service.from("songs").select("lyrics").eq("id", songId).single();
    expect(song.data!.lyrics).toEqual([
      [
        { text: "uno", color_keys: ["sop", "con"] },
        [[{ text: "dos", color_keys: ["con"] }], [{ text: "tres", color_keys: ["sop"] }]]
      ]
    ]);
  });

  it("rejects replacements that are not in the new palette", async () => {
    const { error } = await admin.rpc("update_collection_palette", {
      p_collection_id: collectionId,
      p_hue: 48,
      p_intensity: "media",
      p_track_colors: { sop: { hue: 350, intensity: "media" } },
      p_key_map: { con: "nada" }
    });
    expect(error?.message).toBe("INVALID_PALETTE");
  });
  it("stores an optional name with each track color", async () => {
    const current = await service.from("collections").select("track_colors").eq("id", collectionId).single();
    const colors = current.data!.track_colors as Record<string, Record<string, unknown>>;
    const [first, ...rest] = Object.keys(colors);
    const named = { ...colors, [first!]: { ...colors[first!], name: "Voz 1" } };
    const { error } = await admin.rpc("update_collection_palette", {
      p_collection_id: collectionId,
      p_hue: 48,
      p_intensity: "media",
      p_track_colors: named,
      p_key_map: {}
    });
    expect(error).toBeNull();
    const saved = await service.from("collections").select("track_colors").eq("id", collectionId).single();
    const stored = saved.data!.track_colors as Record<string, Record<string, unknown>>;
    expect(stored[first!]!.name).toBe("Voz 1");
    for (const key of rest) expect(stored[key]!.name).toBeUndefined();
  });

  it("rejects names that are empty, too long or not text", async () => {
    const current = await service.from("collections").select("track_colors").eq("id", collectionId).single();
    const colors = current.data!.track_colors as Record<string, Record<string, unknown>>;
    const first = Object.keys(colors)[0]!;
    for (const name of ["   ", "x".repeat(41), 12]) {
      const { error } = await admin.rpc("update_collection_palette", {
        p_collection_id: collectionId,
        p_hue: 48,
        p_intensity: "media",
        p_track_colors: { ...colors, [first]: { ...colors[first], name } },
        p_key_map: {}
      });
      expect(error?.message).toBe("INVALID_PALETTE");
    }
  });
});
