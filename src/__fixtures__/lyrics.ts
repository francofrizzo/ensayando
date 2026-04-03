import type { CollectionWithRole, LyricStanza, LyricVerse } from "@/data/types";

// --- Individual verses ---

export const emptyVerse: LyricVerse = { text: "" };

export const simpleVerse: LyricVerse = { text: "Hello world" };

export const timedVerse = (start: number, end?: number, text = "Timed verse"): LyricVerse => ({
  text,
  start_time: start,
  end_time: end
});

export const coloredVerse = (text: string, colorKeys: string[]): LyricVerse => ({
  text,
  color_keys: colorKeys
});

export const trackVerse = (text: string, trackIds: number[]): LyricVerse => ({
  text,
  audio_track_ids: trackIds
});

export const fullVerse = (
  text: string,
  opts: Partial<LyricVerse> = {}
): LyricVerse => ({
  text,
  ...opts
});

// --- Lyrics structures ---

/** Empty lyrics */
export const emptyLyrics: LyricStanza[] = [];

/** Single stanza, single verse */
export const singleVerseLyrics: LyricStanza[] = [[simpleVerse]];

/** Single stanza, 3 verses */
export const threeVerseLyrics: LyricStanza[] = [
  [{ text: "Line 1" }, { text: "Line 2" }, { text: "Line 3" }]
];

/** Two stanzas with 2 verses each */
export const twoStanzaLyrics: LyricStanza[] = [
  [{ text: "S1 L1" }, { text: "S1 L2" }],
  [{ text: "S2 L1" }, { text: "S2 L2" }]
];

/** Stanza with a multicolumn item: verse, then columns, then verse */
export const mixedColumnLyrics: LyricStanza[] = [
  [
    { text: "Regular verse" },
    // Multicolumn item: 2 columns, each with 2 lines
    [
      [{ text: "Col1 Line1" }, { text: "Col1 Line2" }],
      [{ text: "Col2 Line1" }, { text: "Col2 Line2" }]
    ],
    { text: "After columns" }
  ]
];

/** Multicolumn with 3 columns */
export const threeColumnLyrics: LyricStanza[] = [
  [
    [
      [{ text: "A1" }],
      [{ text: "B1" }],
      [{ text: "C1" }]
    ]
  ]
];

/** Lyrics with timestamps for status/overlap testing */
export const timedLyrics: LyricStanza[] = [
  [
    timedVerse(0, 3, "Intro"),
    timedVerse(3, 6, "Verse one"),
    timedVerse(6, 9, "Verse two")
  ],
  [
    timedVerse(10, 13, "Chorus")
  ]
];

/** Overlapping timestamps (for regularization column merging) */
export const overlappingTimedLyrics: LyricStanza[] = [
  [
    timedVerse(1, 5, "Voice A"),
    timedVerse(2, 5, "Voice B"), // high overlap with Voice A → should merge
    timedVerse(10, 15, "Solo") // no overlap → separate line
  ]
];

/** Lyrics with track IDs for visibility filtering */
export const trackFilterLyrics: LyricStanza[] = [
  [
    trackVerse("Everyone sings", [1, 2]),
    trackVerse("Only guitar", [1]),
    trackVerse("Only vocals", [2]),
    { text: "No track assigned" }
  ]
];

/** Lyrics with color keys */
export const coloredLyrics: LyricStanza[] = [
  [
    coloredVerse("Red line", ["red"]),
    coloredVerse("Gradient line", ["red", "blue"]),
    { text: "Default color" }
  ]
];

// --- Collection fixture ---

export const mockCollection: CollectionWithRole = {
  id: 1,
  slug: "test-collection",
  title: "Test Collection",
  visible: true,
  main_color: "#3b82f6",
  track_colors: {
    red: "#ef4444",
    blue: "#3b82f6",
    green: "#22c55e"
  },
  artwork_file_url: null,
  is_public: false,
  created_at: "2025-01-01T00:00:00Z",
  user_role: "admin"
};
