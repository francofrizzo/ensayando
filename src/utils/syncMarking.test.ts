import { describe, expect, it } from "vitest";

import type { LyricStanza } from "@/data/types";

import {
  buildSyncUnits,
  countNewTimes,
  firstUnmarkedIndex,
  markEnd,
  markStart,
  outOfOrderIndices,
  regionEnd,
  setUnitTimes,
  unitState
} from "./syncMarking";

const lyrics = (): LyricStanza[] => [
  [
    { text: "Sopla el viento por la loma", color_keys: ["sop"], comment: "Todos", start_time: 12.4 },
    { text: "y se lleva mi canción", color_keys: ["alt"] },
    { text: "" }
  ],
  [
    { text: "Vidala, vidala", color_keys: ["sop", "alt"] },
    [
      [{ text: "Ay, vidala", color_keys: ["sop"] }, { text: "ay", color_keys: ["sop"] }],
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
      ["Ay, vidala", "(uh, uh)"],
      ["ay"]
    ]);
  });

  it("groups each multicolumn row into one unit", () => {
    const row = buildSyncUnits(lyrics())[3]!;
    expect(row.positions).toEqual([
      { stanzaIndex: 1, itemIndex: 1, columnIndex: 0, lineIndex: 0 },
      { stanzaIndex: 1, itemIndex: 1, columnIndex: 1, lineIndex: 0 }
    ]);
    expect(row.colorKeys).toEqual(["sop", "baj"]);
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

  it("marks every verse of a multicolumn row together", () => {
    const source = lyrics();
    const next = markStart(source, buildSyncUnits(source), 3, 33.4);
    const columns = next[1]![1] as { start_time?: number }[][];
    expect(columns[0]![0]!.start_time).toBe(33.4);
    expect(columns[1]![0]!.start_time).toBe(33.4);
    expect(columns[0]![1]!.start_time).toBeUndefined();
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
    current = markStart(current, buildSyncUnits(current), 2, 27); // start + previous end
    expect(countNewTimes(saved, current)).toBe(4);
    expect(countNewTimes(saved, saved)).toBe(0);
  });
});

describe("outOfOrderIndices", () => {
  const unit = (start?: number) => ({ id: String(start), stanzaIndex: 0, positions: [], texts: [], colorKeys: [], start });

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
