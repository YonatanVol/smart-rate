import { HDate, HebrewCalendar, flags } from "@hebcal/core";

/** Demand tier for a Jewish-calendar holiday, ordered weakest → strongest. */
export type HolidayTier = "none" | "minor" | "modern" | "cholHamoed" | "major";

export interface HolidayInfo {
  tier: HolidayTier;
  names: string[];
}

const TIER_RANK: Record<HolidayTier, number> = {
  none: 0,
  minor: 1,
  modern: 2,
  cholHamoed: 3,
  major: 4,
};

/**
 * Look up Jewish-calendar holidays on a Gregorian date (Israel schedule) and
 * classify them into a single demand tier (the strongest hit wins).
 * Pure + deterministic — no I/O. This is the deterministic v1 event source;
 * an LLM layer (M5) can add more events on top.
 */
export function getHolidayInfo(date: Date): HolidayInfo {
  const events = HebrewCalendar.getHolidaysOnDate(new HDate(date), true) ?? [];
  let tier: HolidayTier = "none";
  const names: string[] = [];

  for (const e of events) {
    names.push(e.getDesc());
    const cats = e.getCategories();
    const f = e.getFlags();

    let t: HolidayTier = "none";
    if (f & flags.CHOL_HAMOED) t = "cholHamoed";
    else if (cats.includes("major")) t = "major";
    else if (cats.includes("modern")) t = "modern";
    else if (cats.includes("minor")) t = "minor";

    if (TIER_RANK[t] > TIER_RANK[tier]) tier = t;
  }

  return { tier, names };
}
