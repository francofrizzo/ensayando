import { describe, expect, it } from "vitest";

import type { LyricStanza } from "@/data/types";

import {
  buildSyncUnits,
  clearEnd,
  countNewTimes,
  endTargetIndex,
  firstUnmarkedIndex,
  markEnd,
  markEndAndAdvance,
  markStart,
  outOfOrderIndices,
  regionEnd,
  setUnitTimes,
  unitState
} from "./syncMarking";

const lyrics = (): LyricStanza[] => [
  [
    {
      text: "Sopla el viento por la loma",
      color_keys: ["sop"],
      comment: "Todos",
      start_time: 12.4
    },
    { text: "y se lleva mi canción", color_keys: ["alt"] },
    { text: "" }
  ],
  [
    { text: "Vidala, vidala", color_keys: ["sop", "alt"] },
    [
      [
        { text: "Ay, vidala", color_keys: ["sop"] },
        { text: "ay", color_keys: ["sop"] }
      ],
      [{ text: "(uh, uh)", color_keys: ["baj"] }]
    ]
  ]
];

describe("buildSyncUnits", () => {
  it("lists verses in reading order, skipping empty ones", () => {
    const units = buildSyncUnits(lyrics());
    expect(units.map((u) => u.texts)).toEqual([
      ["Sopla el viento por la loma"],
      ["y se lleva mi canción"],
      ["Vidala, vidala"],
      ["Ay, vidala"],
      ["ay"],
      ["(uh, uh)"]
    ]);
  });

  it("makes every column verse its own unit, column by column, each column its own voice", () => {
    const units = buildSyncUnits(lyrics());
    expect(units.map((u) => u.voice)).toEqual(["main", "main", "main", "1-1-0", "1-1-0", "1-1-1"]);
    expect(units[5]!.positions).toEqual([
      { stanzaIndex: 1, itemIndex: 1, columnIndex: 1, lineIndex: 0 }
    ]);
    expect(units[5]!.colorKeys).toEqual(["baj"]);
  });

  it("carries times, colors and comments", () => {
    const [first] = buildSyncUnits(lyrics());
    expect(first).toMatchObject({ start: 12.4, comment: "Todos", colorKeys: ["sop"] });
  });
});

describe("marking", () => {
  it("starts where the first unmarked unit is", () => {
    expect(firstUnmarkedIndex(buildSyncUnits(lyrics()))).toBe(1);
  });

  it("sets the start and fills the previous unit's missing end", () => {
    const source = lyrics();
    const units = buildSyncUnits(source);
    const next = markStart(source, units, 1, 15.904);
    expect(next[0]![1]).toMatchObject({ start_time: 15.9 });
    expect(next[0]![0]).toMatchObject({ start_time: 12.4, end_time: 15.9 });
    // the input isn't mutated
    expect(source[0]![0]).not.toHaveProperty("end_time");
  });

  it("doesn't overwrite an end the previous unit already has", () => {
    const source = lyrics();
    (source[0]![0] as { end_time?: number }).end_time = 14;
    const next = markStart(source, buildSyncUnits(source), 1, 15.9);
    expect(next[0]![0]).toMatchObject({ end_time: 14 });
  });

  it("moves a previous end that was tied to the old start when re-marking", () => {
    const source = lyrics();
    const once = markStart(source, buildSyncUnits(source), 1, 15.9);
    // Later: no gap after verse 1
    const later = markStart(once, buildSyncUnits(once), 1, 16.5);
    expect(later[0]![0]).toMatchObject({ end_time: 16.5 });
    expect(later[0]![1]).toMatchObject({ start_time: 16.5 });
    // Earlier: no overlap
    const earlier = markStart(once, buildSyncUnits(once), 1, 15.2);
    expect(earlier[0]![0]).toMatchObject({ end_time: 15.2 });
  });

  it("doesn't end the previous stanza's last verse at the next stanza's start", () => {
    const source = lyrics();
    const withSecond = markStart(source, buildSyncUnits(source), 1, 15.9);
    const next = markStart(withSecond, buildSyncUnits(withSecond), 2, 27);
    expect(next[0]![1]).toMatchObject({ start_time: 15.9 });
    expect(next[0]![1]).not.toHaveProperty("end_time");
    expect(next[1]![0]).toMatchObject({ start_time: 27 });
  });

  it("marks one column verse without touching the other columns", () => {
    const source = lyrics();
    const next = markStart(source, buildSyncUnits(source), 3, 33.4);
    const columns = next[1]![1] as { start_time?: number }[][];
    expect(columns[0]![0]!.start_time).toBe(33.4);
    expect(columns[1]![0]!.start_time).toBeUndefined();
    expect(columns[0]![1]!.start_time).toBeUndefined();
  });

  it("fills a missing end only within the same column, never across columns", () => {
    let current = lyrics();
    current = markStart(current, buildSyncUnits(current), 3, 33.4); // column 0, line 0
    current = markStart(current, buildSyncUnits(current), 4, 35); // column 0, line 1
    current = markStart(current, buildSyncUnits(current), 5, 33.6); // column 1, line 0
    const columns = current[1]![1] as { start_time?: number; end_time?: number }[][];
    expect(columns[0]![0]).toMatchObject({ start_time: 33.4, end_time: 35 });
    expect(columns[0]![1]).toMatchObject({ start_time: 35 });
    expect(columns[0]![1]).not.toHaveProperty("end_time");
    expect(columns[1]![0]).toMatchObject({ start_time: 33.6 });
    // The regular verse before the line isn't ended by a column verse either
    expect(current[1]![0]).not.toHaveProperty("end_time");
  });

  it("drops an end that would come before the new start", () => {
    const source = lyrics();
    const withEnd = setUnitTimes(source, buildSyncUnits(source)[1]!, 15, 17);
    const next = markStart(withEnd, buildSyncUnits(withEnd), 1, 18);
    expect(next[0]![1]).toMatchObject({ start_time: 18 });
    expect(next[0]![1]).not.toHaveProperty("end_time");
  });

  it("clamps a negative time (offset before 0) to zero", () => {
    const source = lyrics();
    const next = markStart(source, buildSyncUnits(source), 1, -0.15);
    expect(next[0]![1]).toMatchObject({ start_time: 0 });
  });

  it("marks the end unless it comes before the start", () => {
    const source = lyrics();
    const [first] = buildSyncUnits(source);
    expect(markEnd(source, first!, 14.2)[0]![0]).toMatchObject({ end_time: 14.2 });
    expect(markEnd(source, first!, 10)).toBe(source);
  });
});

describe("markEndAndAdvance", () => {
  it("ends the cursor's unit once it has a start, and moves on", () => {
    const source = lyrics();
    const units = buildSyncUnits(source);
    expect(endTargetIndex(units, 0)).toBe(0);
    const result = markEndAndAdvance(source, units, 0, 14.2);
    expect(result.lyrics[0]![0]).toMatchObject({ end_time: 14.2 });
    expect(result.cursor).toBe(1);
  });

  it("ends the unit just marked when the cursor's has no start, and stays", () => {
    const source = lyrics();
    const units = buildSyncUnits(source);
    // After ↓ on unit 0 the cursor sits on unit 1, still without a start.
    expect(endTargetIndex(units, 1)).toBe(0);
    const result = markEndAndAdvance(source, units, 1, 14.2);
    expect(result.lyrics[0]![0]).toMatchObject({ end_time: 14.2 });
    expect(result.lyrics[0]![1]).not.toHaveProperty("end_time");
    expect(result.cursor).toBe(1);
  });

  it("doesn't move when the end is rejected", () => {
    const source = lyrics();
    const result = markEndAndAdvance(source, buildSyncUnits(source), 0, 10);
    expect(result.lyrics).toBe(source);
    expect(result.cursor).toBe(0);
  });

  it("doesn't move past the last unit", () => {
    const source = lyrics();
    const units = buildSyncUnits(source);
    const last = units.length - 1;
    const marked = markStart(source, units, last, 40);
    const result = markEndAndAdvance(marked, buildSyncUnits(marked), last, 42);
    expect(result.lyrics).not.toBe(marked);
    expect(result.cursor).toBe(last);
  });

  it("does nothing on the first unit without a start (nothing before it)", () => {
    const source: LyricStanza[] = [[{ text: "Uno" }, { text: "Dos" }]];
    const units = buildSyncUnits(source);
    expect(endTargetIndex(units, 0)).toBeUndefined();
    const result = markEndAndAdvance(source, units, 0, 3);
    expect(result).toEqual({ lyrics: source, cursor: 0 });
  });
});

describe("clearEnd", () => {
  it("removes the unit's end and leaves its start", () => {
    const source = lyrics();
    const [first] = buildSyncUnits(source);
    const withEnd = markEnd(source, first!, 14.2);
    const next = clearEnd(withEnd, buildSyncUnits(withEnd)[0]!);
    expect(next[0]![0]).toMatchObject({ start_time: 12.4 });
    expect(next[0]![0]).not.toHaveProperty("end_time");
    // the input isn't mutated
    expect(withEnd[0]![0]).toMatchObject({ end_time: 14.2 });
  });

  it("returns the same lyrics when there's no end to remove", () => {
    const source = lyrics();
    expect(clearEnd(source, buildSyncUnits(source)[0]!)).toBe(source);
  });

  it("only touches its own column verse", () => {
    let current = lyrics();
    const units = buildSyncUnits(current);
    current = setUnitTimes(current, units[3]!, 33, 34);
    current = setUnitTimes(current, units[5]!, 33.5, 36);
    const next = clearEnd(current, buildSyncUnits(current)[3]!);
    const columns = next[1]![1] as { end_time?: number }[][];
    expect(columns[0]![0]).not.toHaveProperty("end_time");
    expect(columns[1]![0]).toMatchObject({ end_time: 36 });
  });
});

describe("regions and states", () => {
  it("ends an open region at the next marked start, or 4 s later", () => {
    const source = lyrics();
    const marked = markStart(source, buildSyncUnits(source), 2, 27);
    const units = buildSyncUnits(marked);
    // unit 0 has no end: next marked start is unit 2 at 27
    expect(regionEnd(units, 0, 240)).toBe(27);
    expect(regionEnd(units, 2, 240)).toBe(31);
    expect(regionEnd(units, 2, 29)).toBe(29);
    expect(regionEnd(units, 1, 240)).toBeUndefined();
  });

  it("names each unit's state", () => {
    const [first, second] = buildSyncUnits(lyrics());
    expect(unitState(first!, false)).toBe("marcado");
    expect(unitState(second!, false)).toBe("sin-tiempo");
    expect(unitState(second!, true)).toBe("marcando");
  });

  it("counts times that are new or changed since saving", () => {
    const saved = lyrics();
    let current = markStart(saved, buildSyncUnits(saved), 1, 15.9); // start + previous end
    current = markStart(current, buildSyncUnits(current), 2, 27); // start only: new stanza
    expect(countNewTimes(saved, current)).toBe(3);
    expect(countNewTimes(saved, saved)).toBe(0);
  });
});

describe("multicolumn regions", () => {
  const multicolumn = (): LyricStanza[] => [
    [
      { text: "antes", start_time: 1 },
      [
        [
          { text: "a1", start_time: 2 },
          { text: "a2", start_time: 5 }
        ],
        [{ text: "b1", start_time: 3 }]
      ],
      { text: "después", start_time: 9 }
    ]
  ];

  it("ends a column verse at the next verse of its column, else at the next regular verse", () => {
    const units = buildSyncUnits(multicolumn());
    const byText = (text: string) => units.findIndex((u) => u.texts[0] === text);
    expect(regionEnd(units, byText("a1"), 240)).toBe(5);
    expect(regionEnd(units, byText("a2"), 240)).toBe(9);
    expect(regionEnd(units, byText("b1"), 240)).toBe(9);
    // A regular verse ends at the line's earliest start
    expect(regionEnd(units, byText("antes"), 240)).toBe(2);
  });

  it("doesn't flag columns that overlap in time as out of order", () => {
    expect([...outOfOrderIndices(buildSyncUnits(multicolumn()))]).toEqual([]);
  });

  it("flags a verse after the line that starts before a column verse", () => {
    const source = multicolumn();
    (source[0]![2] as { start_time?: number }).start_time = 4;
    const units = buildSyncUnits(source);
    expect([...outOfOrderIndices(units)]).toEqual([
      units.findIndex((u) => u.texts[0] === "después")
    ]);
  });
});

describe("outOfOrderIndices", () => {
  const unit = (start?: number) => ({
    id: String(start),
    stanzaIndex: 0,
    voice: "main",
    positions: [],
    texts: [],
    colorKeys: [],
    start
  });

  it("flags a unit that starts before an earlier one", () => {
    expect([...outOfOrderIndices([unit(1), unit(2), unit(1.5), unit(3)])]).toEqual([2]);
  });

  it("skips units without a start", () => {
    expect([...outOfOrderIndices([unit(1), unit(), unit(2)])]).toEqual([]);
  });

  it("compares against the latest start in order, not just the previous unit", () => {
    expect([...outOfOrderIndices([unit(5), unit(1), unit(2), unit(6)])]).toEqual([1, 2]);
  });
});
