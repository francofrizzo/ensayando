import type { Collection, LyricStanza, Song } from "@/data/types";
import { supabase } from "@/lib/supabaseClient";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";

export const fetchCollections = async (): Promise<PostgrestSingleResponse<Collection[]>> => {
  return await supabase.from("collections").select().order("id", { ascending: true });
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

export const updateSongLyrics = async (
  songId: number,
  lyrics: LyricStanza[]
): Promise<PostgrestSingleResponse<null>> => {
  return await supabase.from("songs").update({ lyrics }).eq("id", songId);
};
