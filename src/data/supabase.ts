import type {
  AuthResponse,
  AuthTokenResponse,
  PostgrestSingleResponse
} from "@supabase/supabase-js";

import type { AudioTrack, Collection, CollectionWithRole, LyricStanza, Song } from "@/data/types";
import { supabase } from "@/lib/supabaseClient";

// Authentication functions
export const getSession = async () => {
  return await supabase.auth.getSession();
};

export const onAuthStateChange = (callback: (event: string, session: any) => void) => {
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

export const signUp = async (email: string, password: string): Promise<AuthResponse> => {
  return await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: import.meta.env.VITE_SITE_URL
    }
  });
};

export const signOut = async () => {
  return await supabase.auth.signOut();
};

// Collection and song functions
// Fetch collections available to the current user along with their role in each collection
export const fetchCollections = async (): Promise<
  PostgrestSingleResponse<CollectionWithRole[]>
> => {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      data: [],
      error: null,
      count: null,
      status: 200,
      statusText: "OK"
    } as PostgrestSingleResponse<CollectionWithRole[]>;
  }

  // Join user_collections with collections to get per-collection role
  const response = await supabase
    .from("user_collections")
    .select("role, collections(*)")
    .eq("user_id", user.id);

  if (response.error) {
    return response as PostgrestSingleResponse<CollectionWithRole[]>;
  }

  const mapped: CollectionWithRole[] = (response.data || [])
    .map((row: any) => {
      const collection: Collection | null = row.collections ?? null;
      if (!collection) return null;
      return { ...collection, user_role: row.role } as CollectionWithRole;
    })
    .filter(Boolean) as CollectionWithRole[];

  // Sort by id desc to roughly match previous behavior
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
