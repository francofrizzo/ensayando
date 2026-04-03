import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

// Local Supabase deterministic keys
const SUPABASE_URL = "http://localhost:54321";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const TEST_EMAIL = "test@ensayando.com.ar";
const TEST_PASSWORD = "testpass123";
const TEST_USERNAME = "test";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const FIXTURES_DIR = join(import.meta.dirname, "fixtures");

async function seed() {
  console.log("Seeding local Supabase...");

  // 1. Create test user (idempotent)
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  let userId: string;

  const existing = existingUsers?.users?.find((u) => u.email === TEST_EMAIL);
  if (existing) {
    console.log("  Test user already exists");
    userId = existing.id;
  } else {
    const { data: newUser, error } = await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { username: TEST_USERNAME }
    });
    if (error) throw new Error(`Failed to create user: ${error.message}`);
    userId = newUser.user.id;
    console.log("  Created test user");
  }

  // 2. Check if collection already exists
  const { data: existingCollection } = await supabase
    .from("collections")
    .select("id")
    .eq("slug", "test-collection")
    .maybeSingle();

  if (existingCollection) {
    console.log("  Test data already seeded, skipping");
    return;
  }

  // 3. Create collection
  const { data: collection, error: colError } = await supabase
    .from("collections")
    .insert({
      slug: "test-collection",
      title: "Test Collection",
      main_color: "#3b82f6",
      track_colors: {
        guitar: "#ef4444",
        vocals: "#3b82f6",
        drums: "#22c55e"
      },
      is_public: false
    })
    .select()
    .single();
  if (colError) throw new Error(`Failed to create collection: ${colError.message}`);
  console.log("  Created collection");

  // 4. Link user to collection
  const { error: linkError } = await supabase.from("user_collections").insert({
    user_id: userId,
    collection_id: collection.id,
    role: "admin"
  });
  if (linkError) throw new Error(`Failed to link user: ${linkError.message}`);

  // 5. Create storage bucket (idempotent)
  await supabase.storage.createBucket("audio-files", { public: true });
  console.log("  Ensured audio-files bucket exists");

  // 6. Upload test audio files
  const tracks = ["track-guitar.mp3", "track-vocals.mp3", "track-drums.mp3"];
  const uploadedUrls: string[] = [];

  for (const filename of tracks) {
    const file = readFileSync(join(FIXTURES_DIR, filename));
    const storagePath = `test/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from("audio-files")
      .upload(storagePath, file, {
        contentType: "audio/mpeg",
        upsert: true
      });
    if (uploadError) throw new Error(`Failed to upload ${filename}: ${uploadError.message}`);

    const {
      data: { publicUrl }
    } = supabase.storage.from("audio-files").getPublicUrl(storagePath);
    uploadedUrls.push(publicUrl);
  }
  console.log("  Uploaded audio files");

  // 7. Create song with timed lyrics
  const lyrics = [
    [
      { text: "FIRST VERSE", start_time: 0.5, end_time: 1.5 },
      { text: "SECOND VERSE", start_time: 1.5, end_time: 3.0 },
      { text: "THIRD VERSE", start_time: 3.0, end_time: 4.5 }
    ],
    [{ text: "LAST VERSE", start_time: 4.5, end_time: 5.0 }]
  ];

  const { data: song, error: songError } = await supabase
    .from("songs")
    .insert({
      collection_id: collection.id,
      title: "Test Song",
      slug: "test-song",
      visible: true,
      lyrics
    })
    .select()
    .single();
  if (songError) throw new Error(`Failed to create song: ${songError.message}`);
  console.log("  Created song");

  // 8. Create audio tracks
  const trackConfigs = [
    { title: "Guitar", color_key: "guitar", url: uploadedUrls[0] },
    { title: "Vocals", color_key: "vocals", url: uploadedUrls[1] },
    { title: "Drums", color_key: "drums", url: uploadedUrls[2] }
  ];

  for (let i = 0; i < trackConfigs.length; i++) {
    const config = trackConfigs[i]!;
    const { error: trackError } = await supabase.from("audio_tracks").insert({
      song_id: song.id,
      title: config.title,
      color_key: config.color_key,
      audio_file_url: config.url,
      order: i + 1
    });
    if (trackError) throw new Error(`Failed to create track: ${trackError.message}`);
  }
  console.log("  Created audio tracks");

  console.log("Seeding complete!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
