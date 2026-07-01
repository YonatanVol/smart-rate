import { computePrice, type PriceBreakdown } from "./engine";
import type { PricingConfig } from "./config";
import { addDaysStr, daysBetween } from "../dates";
import { forwardOccupancy, type AvailabilityStatus } from "./occupancy";

export interface UnitEconomics {
  basePrice: number;
  variableCost: number;
  minMargin: number;
  /** owner-set ceiling; null → a sensible multiple of base */
  ceiling: number | null;
}

/** A manual (or LLM-detected) demand event covering an inclusive date range. */
export interface ManualEvent {
  startDate: string; // "YYYY-MM-DD" inclusive
  endDate: string; // inclusive
  multiplier: number;
}

export interface RecommendParams {
  unit: UnitEconomics;
  config?: Partial<PricingConfig>;
  statusByDate: Map<string, AvailabilityStatus>;
  events?: ManualEvent[];
  today: string; // "YYYY-MM-DD"
  from: string; // first night, inclusive
  nights: number;
  occupancyWindowDays?: number;
}

export interface DailyRecommendation {
  date: string; // the night
  breakdown: PriceBreakdown;
}

const DEFAULT_OCCUPANCY_WINDOW = 30;
const DEFAULT_CEILING_FACTOR = 4;

function maxEventMultiplier(events: ManualEvent[], date: string): number {
  let m = 1;
  for (const e of events) {
    if (date >= e.startDate && date <= e.endDate && e.multiplier > m) m = e.multiplier;
  }
  return m;
}

/**
 * Deterministic per-night price recommendations for a unit over a forward range.
 * Pure: it takes availability + events + economics and returns a breakdown per
 * night. Persisting to `price_recommendations` is a thin DB layer on top of this.
 */
export function recommendRange(p: RecommendParams): DailyRecommendation[] {
  const window = p.occupancyWindowDays ?? DEFAULT_OCCUPANCY_WINDOW;
  const floor = p.unit.variableCost + p.unit.minMargin;
  const ceiling = p.unit.ceiling ?? p.unit.basePrice * DEFAULT_CEILING_FACTOR;
  const events = p.events ?? [];
  const out: DailyRecommendation[] = [];

  for (let i = 0; i < p.nights; i++) {
    const date = addDaysStr(p.from, i);
    const status = p.statusByDate.get(date);
    const breakdown = computePrice({
      basePrice: p.unit.basePrice,
      date: new Date(date + "T12:00:00"),
      leadTimeDays: Math.max(0, daysBetween(p.today, date)),
      forwardOccupancy: forwardOccupancy(p.statusByDate, date, window),
      isOpen: status !== "booked" && status !== "blocked",
      manualEventMultiplier: maxEventMultiplier(events, date),
      floor,
      ceiling,
      config: p.config,
    });
    out.push({ date, breakdown });
  }
  return out;
}
