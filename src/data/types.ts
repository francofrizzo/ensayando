export type Collection = {
  id: number;
  slug: string;
  title: string;
  visible: boolean;
  main_color: string;
  track_colors: Record<string, string>;
  artwork_file_url: string | null;
  created_at: string;
};

export type CollectionRole = "admin" | "editor" | "viewer";

export type CollectionWithRole = Collection & {
  user_role: CollectionRole;
};

export type Song = {
  id: number;
  slug: string;
  collection_id: number;
  title: string;
  lyrics: LyricStanza[] | null;
  audio_tracks: AudioTrack[];
  visible: boolean;
  created_at: string;
};

export type AudioTrack = {
  id: number;
  song_id: number;
  title: string;
  color_key: string;
  audio_file_url: string;
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
