import type {
  AuthResponse,
  AuthSession,
  AuthTokenResponse,
  PostgrestSingleResponse
} from "@supabase/supabase-js";

import type { AudioTrack, Collection, CollectionWithRole, LyricStanza, Song } from "@/data/types";
import { supabase } from "@/lib/supabaseClient";

// Authentication functions
export const getSession = async () => {
  return await supabase.auth.getSession();
};

export const onAuthStateChange = (
  callback: (event: string, session: AuthSession | null) => void
) => {
  return supabase.auth.onAuthStateChange(callback);
};

export const signInWithPassword = async (
  email: string,
  password: string
): Promise<AuthTokenResponse> => {
  return await supabase.auth.signInWithPassword({
    email,
    password
  });
};

export const signUp = async (
  email: string,
  password: string,
  username: string
): Promise<AuthResponse> => {
  return await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username }
    }
  });
};

export const signOut = async () => {
  return await supabase.auth.signOut();
};

export const resetPasswordForEmail = async (email: string, redirectTo: string) => {
  return await supabase.auth.resetPasswordForEmail(email, { redirectTo });
};

export const updatePassword = async (newPassword: string) => {
  return await supabase.auth.updateUser({ password: newPassword });
};

// Collection and song functions

// Fetch collections that should appear in the sidebar listing (no auth required).
// Only "public" collections are listed; "unlisted" ones are reachable by link but hidden here.
export const fetchListedCollections = async (): Promise<PostgrestSingleResponse<Collection[]>> => {
  return await supabase.from("collections").select("*").eq("visibility", "public");
};

// Fetch a single collection by slug. RLS decides visibility: anyone can read "public" and
// "unlisted" collections by their link; "private" ones only resolve for members. Returns
// data === null (with no error) when the slug doesn't exist or isn't readable.
export const fetchCollectionBySlug = async (
  slug: string
): Promise<PostgrestSingleResponse<Collection | null>> => {
  return await supabase.from("collections").select("*").eq("slug", slug).maybeSingle();
};

// Fetch collections available to the current user along with their role in each collection
export const fetchCollections = async (): Promise<
  PostgrestSingleResponse<CollectionWithRole[]>
> => {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  // Unauthenticated: return only listed (public) collections with viewer role
  if (!user) {
    const publicResponse = await fetchListedCollections();
    if (publicResponse.error) {
      return publicResponse as PostgrestSingleResponse<CollectionWithRole[]>;
    }
    const mapped: CollectionWithRole[] = (publicResponse.data || []).map((collection) => ({
      ...collection,
      user_role: "viewer" as const
    }));
    mapped.sort((a, b) => b.id - a.id);
    return {
      data: mapped,
      error: null,
      count: null,
      status: 200,
      statusText: "OK"
    } as PostgrestSingleResponse<CollectionWithRole[]>;
  }

  // Authenticated: fetch user's own collections + listed (public) collections, merge
  const [userResponse, publicResponse] = await Promise.all([
    supabase.from("user_collections").select("role, collections(*)").eq("user_id", user.id),
    fetchListedCollections()
  ]);

  if (userResponse.error) {
    return userResponse as PostgrestSingleResponse<CollectionWithRole[]>;
  }

  // Build map from user's collections (these take priority)
  const collectionsMap = new Map<number, CollectionWithRole>();

  for (const row of userResponse.data || []) {
    const collection: Collection | null =
      (row as unknown as { role: string; collections: Collection | null }).collections ?? null;
    if (!collection) continue;
    collectionsMap.set(collection.id, { ...collection, user_role: row.role } as CollectionWithRole);
  }

  // Merge public collections (only add if user doesn't already have them)
  if (!publicResponse.error && publicResponse.data) {
    for (const collection of publicResponse.data) {
      if (!collectionsMap.has(collection.id)) {
        collectionsMap.set(collection.id, { ...collection, user_role: "viewer" as const });
      }
    }
  }

  const mapped = Array.from(collectionsMap.values());
  mapped.sort((a, b) => b.id - a.id);

  return {
    data: mapped,
    error: null,
    count: null,
    status: 200,
    statusText: "OK"
  } as PostgrestSingleResponse<CollectionWithRole[]>;
};

export const fetchSongsByCollectionId = async (
  collectionId: number
): Promise<PostgrestSingleResponse<Song[]>> => {
  return await supabase
    .from("songs")
    .select("*, audio_tracks(*)")
    .eq("collection_id", collectionId)
    .order("order", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });
};

export const updateSongBasicInfo = async (
  songId: number,
  updates: { title: string; slug: string; visible: boolean }
): Promise<PostgrestSingleResponse<null>> => {
  return await supabase.from("songs").update(updates).eq("id", songId);
};

export const insertSong = async (songData: {
  collection_id: number;
  title: string;
  slug: string;
  visible: boolean;
}): Promise<PostgrestSingleResponse<Song[]>> => {
  return await supabase.from("songs").insert(songData).select("*, audio_tracks(*)");
};

export const updateSongLyrics = async (
  songId: number,
  lyrics: LyricStanza[]
): Promise<PostgrestSingleResponse<null>> => {
  return await supabase.from("songs").update({ lyrics }).eq("id", songId);
};

export const insertAudioTrack = async (
  trackData: Omit<AudioTrack, "id" | "created_at">
): Promise<PostgrestSingleResponse<null>> => {
  return await supabase.from("audio_tracks").insert(trackData);
};

export const updateAudioTrack = async (
  trackId: number,
  updates: Partial<Pick<AudioTrack, "title" | "color_key" | "audio_file_url" | "order" | "peaks">>
): Promise<PostgrestSingleResponse<AudioTrack[]>> => {
  return await supabase.from("audio_tracks").update(updates).eq("id", trackId).select();
};

export const deleteAudioTracks = async (
  trackIds: number[]
): Promise<PostgrestSingleResponse<null>> => {
  return await supabase.from("audio_tracks").delete().in("id", trackIds);
};
