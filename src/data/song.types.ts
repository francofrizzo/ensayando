export type Song = {
  id: string;
  collectionId: string;
  title: string;
  artist?: string;
  artwork?: string;
  tracks: Track[];
  lyrics: LyricGroup[];
};

export type LyricGroup = LyricGroupItem[];

export type LyricGroupItem = Lyric | LyricColumn[];

export type LyricColumn = Lyric[];

export type Track = {
  id: string;
  title: string;
  subtitle?: string;
  file: string;
};

export type Lyric = {
  startTime: number;
  endTime?: number;
  text: string;
  tracks?: string[];
  visualTracks?: string[];
  comment?: string;
};
