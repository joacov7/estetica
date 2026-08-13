import { describe, it, expect } from "vitest";
import {
  mergeIntervals,
  subtractIntervals,
  slotStarts,
  computeDaySlots,
} from "./core";

const min = (h: number, m = 0) => h * 60 + m;

describe("mergeIntervals", () => {
  it("merges overlapping and adjacent intervals", () => {
    expect(
      mergeIntervals([
        { start: min(10), end: min(12) },
        { start: min(11), end: min(13) }, // overlaps
        { start: min(13), end: min(14) }, // adjacent
        { start: min(16), end: min(17) }, // separate
      ]),
    ).toEqual([
      { start: min(10), end: min(14) },
      { start: min(16), end: min(17) },
    ]);
  });

  it("drops empty/invalid intervals", () => {
    expect(mergeIntervals([{ start: min(10), end: min(10) }])).toEqual([]);
  });
});

describe("subtractIntervals", () => {
  it("removes busy periods from a working window", () => {
    const windows = [{ start: min(10), end: min(19) }];
    const busy = [
      { start: min(11), end: min(12) },
      { start: min(15), end: min(16, 30) },
    ];
    expect(subtractIntervals(windows, busy)).toEqual([
      { start: min(10), end: min(11) },
      { start: min(12), end: min(15) },
      { start: min(16, 30), end: min(19) },
    ]);
  });

  it("handles busy periods at the edges", () => {
    const windows = [{ start: min(10), end: min(12) }];
    expect(subtractIntervals(windows, [{ start: min(10), end: min(11) }])).toEqual([
      { start: min(11), end: min(12) },
    ]);
  });

  it("returns nothing when fully booked", () => {
    const windows = [{ start: min(10), end: min(12) }];
    expect(subtractIntervals(windows, [{ start: min(9), end: min(13) }])).toEqual([]);
  });
});

describe("slotStarts", () => {
  it("emits aligned starts that fully fit the slot length", () => {
    const free = [{ start: min(10), end: min(12) }];
    // 90-min slot, 30-min step → only 10:00 and 10:30 fit (end 11:30 / 12:00)
    expect(slotStarts(free, 90, 30)).toEqual([min(10), min(10, 30)]);
  });

  it("aligns the first start up to the step grid", () => {
    const free = [{ start: min(10, 10), end: min(12) }];
    // first aligned start after 10:10 is 10:30; 11:00 also fits (ends 12:00)
    expect(slotStarts(free, 60, 30)).toEqual([min(10, 30), min(11)]);
  });

  it("returns nothing when the slot cannot fit", () => {
    expect(slotStarts([{ start: min(10), end: min(11) }], 90, 30)).toEqual([]);
  });
});

describe("computeDaySlots (integration of the pure pipeline)", () => {
  it("never offers a slot that overlaps an existing appointment", () => {
    const slots = computeDaySlots({
      workWindows: [{ start: min(10), end: min(19) }],
      busy: [{ start: min(14), end: min(15, 30) }], // existing Kapping incl. buffer
      slotLength: 90,
      step: 30,
    });
    // A 90-min slot starting at 13:00 would end 14:30 and overlap → excluded.
    expect(slots).not.toContain(min(13));
    expect(slots).not.toContain(min(14));
    // 12:30 (ends 14:00) and 15:30 (ends 17:00) are valid.
    expect(slots).toContain(min(12, 30));
    expect(slots).toContain(min(15, 30));
  });

  it("respects the earliest-start lower bound (e.g. today)", () => {
    const slots = computeDaySlots({
      workWindows: [{ start: min(10), end: min(19) }],
      busy: [],
      slotLength: 60,
      step: 60,
      earliestStart: min(15),
    });
    expect(Math.min(...slots)).toBe(min(15));
  });
});
