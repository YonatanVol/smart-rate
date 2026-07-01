/** Add `n` days to a "YYYY-MM-DD" string (noon-anchored, DST-safe). */
export function addDaysStr(d: string, n: number): string {
  const dt = new Date(d + "T12:00:00");
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** Whole days from `from` to `to` (both "YYYY-MM-DD"); negative when `to` precedes `from`. */
export function daysBetween(from: string, to: string): number {
  const a = new Date(from + "T12:00:00").getTime();
  const b = new Date(to + "T12:00:00").getTime();
  return Math.round((b - a) / 86_400_000);
}

/**
 * Inclusive-start, exclusive-end range of "YYYY-MM-DD" strings — matches iCal
 * DATE semantics (DTEND is exclusive, so the checkout day is left free). Returns
 * [] when `endExclusive` is not after `startInclusive`.
 */
export function dateRange(startInclusive: string, endExclusive: string): string[] {
  const out: string[] = [];
  for (let d = startInclusive; d < endExclusive; d = addDaysStr(d, 1)) out.push(d);
  return out;
}
