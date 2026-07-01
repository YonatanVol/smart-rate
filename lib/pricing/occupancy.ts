/** Per-night availability status (mirrors the `availability_status` DB enum). */
export type AvailabilityStatus = "open" | "booked" | "blocked";

/** Add `n` days to a "YYYY-MM-DD" string (noon-anchored, DST-safe). */
export function addDaysStr(d: string, n: number): string {
  const dt = new Date(d + "T12:00:00");
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/**
 * Forward occupancy (0..1) over the window [from, from+windowDays): booked nights
 * ÷ *sellable* nights (open + booked). Owner-blocked nights are excluded from the
 * denominator; unknown dates are treated as open. Returns 0 when nothing is
 * sellable — the engine's occupancy weight keeps that neutral during cold-start.
 */
export function forwardOccupancy(
  statusByDate: Map<string, AvailabilityStatus>,
  from: string,
  windowDays: number,
): number {
  let booked = 0;
  let sellable = 0;
  for (let i = 0; i < windowDays; i++) {
    const s = statusByDate.get(addDaysStr(from, i));
    if (s === "blocked") continue;
    sellable++;
    if (s === "booked") booked++;
  }
  return sellable === 0 ? 0 : booked / sellable;
}
