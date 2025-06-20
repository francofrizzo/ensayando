import type {
  AuthResponse,
  AuthTokenResponse,
  PostgrestSingleResponse
} from "@supabase/supabase-js";

import type { AudioTrack, Collection, LyricStanza, Song } from "@/data/types";
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
export const fetchCollections = async (): Promise<PostgrestSingleResponse<Collection[]>> => {
  return await supabase.from("collections").select().order("id", { ascending: false });
};

export const fetchSongsByCollectionId = async (
  collectionId: number
): Promise<PostgrestSingleResponse<Song[]>> => {
  return await supabase
    .from("songs")
    .select("*, audio_tracks(*)")
    .order("id", { ascending: true })
    .eq("collection_id", collectionId);
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
  updates: Partial<Pick<AudioTrack, "title" | "color_key" | "audio_file_url" | "order">>
): Promise<PostgrestSingleResponse<AudioTrack[]>> => {
  return await supabase.from("audio_tracks").update(updates).eq("id", trackId).select();
};

export const deleteAudioTracks = async (
  trackIds: number[]
): Promise<PostgrestSingleResponse<null>> => {
  return await supabase.from("audio_tracks").delete().in("id", trackIds);
};
