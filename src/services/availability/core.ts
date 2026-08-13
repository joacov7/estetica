/**
 * Pure availability math — no dates, no timezones, no I/O.
 *
 * Everything here works in "minutes from local midnight" so it is trivially
 * testable. The timezone-aware orchestration lives in ./index.ts.
 */

export interface Interval {
  /** minutes from local midnight, inclusive start */
  start: number;
  /** minutes from local midnight, exclusive end */
  end: number;
}

/** Clamp and normalize an interval; returns null if empty/invalid. */
function normalize(i: Interval): Interval | null {
  const start = Math.max(0, i.start);
  const end = i.end;
  if (end <= start) return null;
  return { start, end };
}

/** Merge overlapping/adjacent intervals into a sorted, disjoint set. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const clean = intervals
    .map(normalize)
    .filter((x): x is Interval => x !== null)
    .sort((a, b) => a.start - b.start);

  const out: Interval[] = [];
  for (const cur of clean) {
    const last = out[out.length - 1];
    if (last && cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

/**
 * Subtract `busy` intervals from `windows` (working periods).
 * Returns the free intervals, sorted and disjoint.
 */
export function subtractIntervals(
  windows: Interval[],
  busy: Interval[],
): Interval[] {
  const merged = mergeIntervals(busy);
  const result: Interval[] = [];

  for (const win of mergeIntervals(windows)) {
    let cursor = win.start;
    for (const b of merged) {
      if (b.end <= cursor || b.start >= win.end) continue; // no overlap
      if (b.start > cursor) result.push({ start: cursor, end: Math.min(b.start, win.end) });
      cursor = Math.max(cursor, b.end);
      if (cursor >= win.end) break;
    }
    if (cursor < win.end) result.push({ start: cursor, end: win.end });
  }
  return result.filter((i) => i.end > i.start);
}

/**
 * Given free intervals, return the start minutes at which a slot of
 * `slotLength` minutes fits entirely inside a single free interval.
 *
 * Candidate starts are aligned to `step` minutes from midnight (e.g. every
 * 15/30 min) and must satisfy start >= interval.start.
 */
export function slotStarts(
  free: Interval[],
  slotLength: number,
  step: number,
): number[] {
  if (slotLength <= 0 || step <= 0) return [];
  const starts: number[] = [];

  for (const iv of free) {
    // first aligned minute >= iv.start
    let t = Math.ceil(iv.start / step) * step;
    while (t + slotLength <= iv.end) {
      starts.push(t);
      t += step;
    }
  }
  return starts;
}

/**
 * End-to-end pure computation of available slot start minutes for one day.
 */
export function computeDaySlots(params: {
  workWindows: Interval[];
  busy: Interval[];
  slotLength: number;
  step: number;
  /** Optional lower bound (minutes from midnight) — slots must start at/after. */
  earliestStart?: number;
}): number[] {
  const { workWindows, busy, slotLength, step, earliestStart = 0 } = params;
  const free = subtractIntervals(workWindows, busy);
  return slotStarts(free, slotLength, step).filter((s) => s >= earliestStart);
}
