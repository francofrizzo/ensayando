import type { Intensity, TrackColor } from "@/utils/palette";

// "private": only members (via user_collections) can read it.
// "unlisted": anyone with the link can read it, but it's hidden from sidebar listings.
// "public": anyone can read it and it shows up in every sidebar.
export type CollectionVisibility = "private" | "unlisted" | "public";

export type Collection = {
  id: number;
  slug: string;
  title: string;
  // Palette: a hue (0–359) and an intensity; every color is derived from them
  // (utils/palette.ts). Tracks point at a key in track_colors via color_key.
  hue: number;
  intensity: Intensity;
  track_colors: Record<string, TrackColor>;
  artwork_file_key?: string | null;
  artwork_playback_url?: string;
  visibility: CollectionVisibility;
  created_by: string | null;
  created_at: string;
};

export type CollectionRole = "admin" | "editor" | "viewer";

export type CollectionWithRole = Collection & {
  user_role: CollectionRole;
  // True when the person has a row in user_collections; public or linked
  // collections they only visit are listed too, but aren't theirs.
  is_member?: boolean;
};

export type Song = {
  id: number;
  slug: string;
  collection_id: number;
  title: string;
  lyrics: LyricStanza[] | null;
  audio_tracks: AudioTrack[];
  visible: boolean;
  // Seconds, from the tracks' peaks; written when the song is saved.
  duration: number | null;
  order: number | null;
  created_at: string;
};

export type AudioTrack = {
  id: number;
  song_id: number;
  title: string;
  color_key: string;
  audio_file_url: string;
  audio_file_key?: string | null;
  playback_url?: string;
  peaks: TrackPeaks | null;
  order: number | null;
  created_at: string;
};

// Each element in the array is a LyricVerse or a multicolumn array of LyricVerse
export type LyricStanza = (LyricVerse | LyricVerse[][])[];

export type LyricVerse = {
  start_time?: number;
  end_time?: number;
  text: string;
  comment?: string;
  audio_track_ids?: number[];
  color_keys?: string[];
};

export type TrackPeaks = {
  channels: number[][];
  duration: number;
};

// ---------------------------------------------------------------------------
// Administration (collection settings)
// ---------------------------------------------------------------------------

export type CollectionMember = {
  user_id: string;
  email: string;
  username: string;
  // Username-only account (<user>@ensayando.com.ar): no inbox, passwords are reset
  // by an admin.
  is_managed: boolean;
  role: CollectionRole;
  last_sign_in_at: string | null;
};

export type AccountMatch = Pick<CollectionMember, "user_id" | "email" | "username" | "is_managed">;

export type CreatedManagedAccount = { userId: string; username: string; password: string };

export type InvitedMember = { userId: string; email: string };

export type PasswordReset =
  | { kind: "password"; password: string }
  | { kind: "email"; email: string };

export type DeletionResult = { orphanedKeys: string[] };
