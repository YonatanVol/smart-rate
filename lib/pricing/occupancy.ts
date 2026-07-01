import { addDaysStr } from "../dates";

/** Per-night availability status (mirrors the `availability_status` DB enum). */
export type AvailabilityStatus = "open" | "booked" | "blocked";

export { addDaysStr };

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
