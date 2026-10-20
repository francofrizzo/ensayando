// @vitest-environment node
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.SUPABASE_DB_TEST === "1";
const url = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321";
// Deliberately require local keys rather than embedding credentials.
const anonKey = process.env.SUPABASE_TEST_ANON_KEY ?? "local-key-required";
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? "local-key-required";
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const run = randomUUID().slice(0, 8);

describe.skipIf(!enabled)("collection parts database contract", () => {
  const service = createClient(url, serviceKey, options);
  const collections: number[] = [];
  const users: string[] = [];
  let admin: SupabaseClient;
  let editor: SupabaseClient;
  let viewer: SupabaseClient;
  let song: number;
  let otherSong: number;
  let a: string;
  let b: string;
  let foreign: string;
  let track: number;
  let foreignTrack: number;

  async function login(role: string) {
    const email = `parts-${role}-${run}@example.com`;
    const password = "parts-test-password-123";
    const result = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (result.error || !result.data.user) throw result.error ?? new Error("no user");
    const id = result.data.user.id;
    users.push(id);
    const membership = await service
      .from("user_collections")
      .insert({ user_id: id, collection_id: collections[0], role });
    if (membership.error) throw membership.error;
    const client = createClient(url, anonKey, options);
    const signed = await client.auth.signInWithPassword({ email, password });
    if (signed.error) throw signed.error;
    return client;
  }
  async function lyrics() {
    const result = await service.from("songs").select("lyrics").eq("id", song).single();
    if (result.error) throw result.error;
    return result.data.lyrics;
  }
  async function save(value: unknown) {
    return editor.from("songs").update({ lyrics: value }).eq("id", song);
  }
  beforeAll(async () => {
    if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(url))
      throw new Error("Local database only");
    if (!process.env.SUPABASE_TEST_SERVICE_ROLE_KEY || !process.env.SUPABASE_TEST_ANON_KEY) {
      throw new Error("Export local SUPABASE_TEST_ANON_KEY and SUPABASE_TEST_SERVICE_ROLE_KEY");
    }
    for (let i = 0; i < 2; i++) {
      const result = await service
        .from("collections")
        .insert({
          slug: `parts-${run}-${i}`,
          title: "Partes",
          visibility: "private",
          hue: 100,
          track_colors: {
            a: { hue: 10, intensity: "media" },
            b: { hue: 20, intensity: "media" },
            chosen: { neutral: true }
          }
        })
        .select("id")
        .single();
      if (result.error) throw result.error;
      collections.push(result.data.id);
    }
    [admin, editor, viewer] = await Promise.all([login("admin"), login("editor"), login("viewer")]);
    const parts = await service
      .from("collection_parts")
      .insert([
        { collection_id: collections[0], name: "Solo A", color_key: "a" },
        { collection_id: collections[0], name: "Solo B", color_key: "b" },
        { collection_id: collections[1], name: "Otra", color_key: "a" }
      ])
      .select("id");
    if (parts.error) throw parts.error;
    [a, b, foreign] = parts.data.map((p) => p.id) as [string, string, string];
    const songs = await service
      .from("songs")
      .insert(
        collections.map((collection_id, i) => ({
          collection_id,
          slug: `song-${i}`,
          title: "Canción",
          lyrics: []
        }))
      )
      .select("id");
    if (songs.error) throw songs.error;
    [song, otherSong] = songs.data.map((s) => s.id) as [number, number];
    const tracks = await service
      .from("audio_tracks")
      .insert([
        {
          song_id: song,
          title: "Solistas",
          audio_file_url: "x",
          color_key: "chosen",
          kind: "voice",
          part_ids: [a, b]
        },
        {
          song_id: otherSong,
          title: "Otra",
          audio_file_url: "x",
          color_key: "a",
          kind: "unclassified",
          part_ids: []
        }
      ])
      .select("id");
    if (tracks.error) throw tracks.error;
    [track, foreignTrack] = tracks.data.map((t) => t.id) as [number, number];
  });
  afterAll(async () => {
    for (const id of collections) {
      const result = await service.from("collections").delete().eq("id", id);
      expect(result.error).toBeNull();
    }
    for (const id of users) await service.auth.admin.deleteUser(id);
  });

  it("uses collection visibility and admin-only part writes", async () => {
    expect((await viewer.from("collection_parts").select("id")).data?.map((p) => p.id)).toEqual(
      expect.arrayContaining([a, b])
    );
    expect((await viewer.from("collection_parts").select("id").eq("id", foreign)).data).toEqual([]);
    expect(
      (
        await editor
          .from("collection_parts")
          .insert({ collection_id: collections[0], name: "No", color_key: "a" })
      ).error
    ).not.toBeNull();
    expect(
      (await admin.from("collection_parts").update({ name: "Solista A" }).eq("id", a)).error
    ).toBeNull();
    expect(
      (
        await editor.rpc("update_collection_parts", {
          p_collection_id: collections[0],
          p_parts: []
        })
      ).error?.message
    ).toBe("FORBIDDEN");
    const payload = [
      { id: b, name: "Solo B", color_key: "b", parent_id: a, order: 1 },
      { id: a, name: "Solista A", color_key: "a", parent_id: null, order: 0 }
    ];
    expect(
      (
        await admin.rpc("update_collection_parts", {
          p_collection_id: collections[0],
          p_parts: payload
        })
      ).error
    ).toBeNull();
    expect(
      (
        await admin.rpc("update_collection_parts", {
          p_collection_id: collections[0],
          p_parts: [payload[0]]
        })
      ).error
    ).not.toBeNull();
    expect(
      (await service.from("collection_parts").select("parent_id").eq("id", b).single()).data
        ?.parent_id
    ).toBe(a);
  });
  it("saves parts and palette together and rolls both back on an invalid hierarchy", async () => {
    const before = await service
      .from("collection_parts")
      .select("*")
      .eq("collection_id", collections[0]!);
    expect(before.error).toBeNull();
    const args = {
      p_collection_id: collections[0],
      p_hue: 155,
      p_intensity: "intensa",
      p_track_colors: {
        a: { hue: 15, intensity: "media" },
        b: { hue: 20, intensity: "media" },
        chosen: { neutral: true }
      },
      p_key_map: {},
      p_parts: before.data!.map((part) => ({ ...part, name: `${part.name} nuevo` }))
    };
    expect((await viewer.rpc("update_collection_music", args)).error?.message).toBe("FORBIDDEN");
    const invalid = {
      ...args,
      p_parts: args.p_parts.map((part) => ({ ...part, parent_id: part.id }))
    };
    expect((await admin.rpc("update_collection_music", invalid)).error).not.toBeNull();
    expect(
      (await service.from("collections").select("hue").eq("id", collections[0]!).single()).data?.hue
    ).toBe(100);
    expect(
      (await service.from("collection_parts").select("*").eq("collection_id", collections[0]!)).data
    ).toEqual(before.data);
    expect((await admin.rpc("update_collection_music", args)).error).toBeNull();
    expect(
      (await service.from("collections").select("hue").eq("id", collections[0]!).single()).data?.hue
    ).toBe(155);
    expect(
      (await service.from("collection_parts").select("name").eq("id", a).single()).data?.name
    ).toBe("Solista A nuevo");
  });
  it("rejects invalid colors, parents, names, cross-collection mappings and cross-song audio", async () => {
    for (const patch of [
      { color_key: "missing" },
      { parent_id: foreign },
      { parent_id: a },
      { name: " " }
    ]) {
      expect((await admin.from("collection_parts").update(patch).eq("id", a)).error).not.toBeNull();
    }
    expect(
      (await admin.from("collection_parts").update({ parent_id: a }).eq("id", b)).error
    ).toBeNull();
    expect(
      (await admin.from("collection_parts").update({ parent_id: b }).eq("id", a)).error?.message
    ).toContain("INVALID_PART_PARENT");
    expect((await save([[{ text: "bad", part_ids: [foreign] }]])).error?.message).toContain(
      "INVALID_PART_IDS"
    );
    expect(
      (await save([[{ text: "bad", audio_track_ids: [foreignTrack] }]])).error?.message
    ).toContain("INVALID_TRACK_IDS");
    expect(
      (
        await editor
          .from("audio_tracks")
          .update({ part_ids: [foreign] })
          .eq("id", track)
      ).error?.message
    ).toContain("INVALID_PART_IDS");
    expect(
      (await editor.from("audio_tracks").update({ kind: "instrumental" }).eq("id", track)).error
    ).not.toBeNull();
  });
  it("materializes grouped audio once, in nested columns, without changing chosen track colors", async () => {
    expect(
      (
        await save([
          [
            [
              [
                {
                  text: "both",
                  start_time: 3,
                  part_ids: [b, a],
                  audio_override: false,
                  color_override: false
                }
              ]
            ]
          ]
        ])
      ).error
    ).toBeNull();
    expect((await lyrics())[0][0][0][0]).toEqual({
      text: "both",
      start_time: 3,
      part_ids: [b, a],
      color_keys: ["b", "a"],
      audio_track_ids: [track],
      audio_override: false,
      color_override: false
    });
    expect(
      (await service.from("audio_tracks").select("color_key").eq("id", track).single()).data
        ?.color_key
    ).toBe("chosen");
  });
  it("resyncs colors and mappings, omits missing audio, and preserves explicit exceptions", async () => {
    expect(
      (await admin.from("collection_parts").update({ color_key: "chosen" }).eq("id", a)).error
    ).toBeNull();
    expect((await lyrics())[0][0][0][0].color_keys).toEqual(["b", "chosen"]);
    expect(
      (await editor.from("audio_tracks").update({ part_ids: [] }).eq("id", track)).error
    ).toBeNull();
    expect((await lyrics())[0][0][0][0]).not.toHaveProperty("audio_track_ids");
    const exception = {
      text: "except",
      start_time: 7,
      part_ids: [a],
      color_keys: ["b"],
      audio_track_ids: [track],
      audio_override: true,
      color_override: true
    };
    expect((await save([[exception]])).error).toBeNull();
    expect(
      (
        await editor
          .from("audio_tracks")
          .update({ part_ids: [a, b] })
          .eq("id", track)
      ).error
    ).toBeNull();
    expect(
      (await admin.from("collection_parts").update({ color_key: "a" }).eq("id", a)).error
    ).toBeNull();
    expect(await lyrics()).toEqual([[exception]]);
    expect(
      (await save([[{ ...exception, audio_override: false, color_override: false }]])).error
    ).toBeNull();
    expect((await lyrics())[0][0].color_keys).toEqual(["a"]);
  });
  it("treats old-client edits of materialized fields as explicit overrides", async () => {
    const verse = (await lyrics())[0][0];
    expect(
      (await save([[{ ...verse, color_keys: ["chosen"], audio_track_ids: [] }]])).error
    ).toBeNull();
    expect((await lyrics())[0][0]).toMatchObject({
      color_override: true,
      audio_override: true,
      color_keys: ["chosen"],
      audio_track_ids: []
    });
  });
  it("blocks referenced deletions and counts part-only colors in atomic palette remaps", async () => {
    expect((await admin.from("collection_parts").delete().eq("id", a)).error?.message).toContain(
      "PART_IN_USE"
    );
    expect((await save([[{ text: "reference", audio_track_ids: [track] }]])).error).toBeNull();
    expect((await admin.from("audio_tracks").delete().eq("id", track)).error?.message).toContain(
      "TRACK_IN_USE"
    );
    expect(
      (
        await save([
          [{ text: "canonical", part_ids: [a], color_override: false, audio_override: false }]
        ])
      ).error
    ).toBeNull();
    const palette = { chosen: { neutral: true }, b: { hue: 20, intensity: "media" } };
    const args = {
      p_collection_id: collections[0],
      p_hue: 100,
      p_intensity: "media",
      p_track_colors: palette,
      p_key_map: {}
    };
    expect((await admin.rpc("update_collection_palette", args)).error?.message).toBe("KEY_IN_USE");
    expect(
      (await admin.rpc("update_collection_palette", { ...args, p_key_map: { a: "b" } })).error
    ).toBeNull();
    expect(
      (await service.from("collection_parts").select("color_key").eq("id", a).single()).data
        ?.color_key
    ).toBe("b");
    expect(
      (await service.from("audio_tracks").select("color_key").eq("id", track).single()).data
        ?.color_key
    ).toBe("chosen");
    expect((await lyrics())[0][0]).toMatchObject({ color_keys: ["b"], color_override: false });
    // Swaps must remap canonical part colors exactly once, not twice.
    expect(
      (
        await admin.rpc("update_collection_palette", {
          ...args,
          p_track_colors: { b: { hue: 20, intensity: "media" }, chosen: { neutral: true } },
          p_key_map: { b: "chosen", chosen: "b" }
        })
      ).error
    ).toBeNull();
    expect((await lyrics())[0][0]).toMatchObject({ color_keys: ["chosen"], color_override: false });
    expect((await admin.from("songs").delete().eq("id", song)).error).toBeNull();
    expect((await service.from("audio_tracks").select("id").eq("id", track)).data).toEqual([]);
  });
});
