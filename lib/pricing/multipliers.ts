import { getHolidayInfo } from "../calendar/hebcal";
import type { Band, PricingConfig } from "./config";

/** Return the multiplier of the first band whose upper bound covers `value`. */
function pickBand(bands: Band[], value: number): number {
  for (const b of bands) {
    if (value <= b.upTo) return b.mult;
  }
  return bands.length ? bands[bands.length - 1].mult : 1;
}

export function dowMultiplier(date: Date, cfg: PricingConfig): number {
  return cfg.dow[date.getDay()];
}

export function seasonMultiplier(date: Date, cfg: PricingConfig): number {
  return cfg.seasonByMonth[date.getMonth()];
}

/**
 * Strongest single event wins (Hebrew holiday vs. a manual event) — we take the
 * max rather than multiplying, to avoid runaway stacking on overlapping events.
 */
export function eventMultiplier(
  date: Date,
  cfg: PricingConfig,
  manualMultiplier = 1,
): { mult: number; holidayNames: string[] } {
  const info = getHolidayInfo(date);
  const tierMult = cfg.eventTier[info.tier];
  return { mult: Math.max(tierMult, manualMultiplier), holidayNames: info.names };
}

/** Occupancy band, blended toward neutral by the configured weight (cold-start safe). */
export function occupancyMultiplier(forwardOccupancy: number, cfg: PricingConfig): number {
  const raw = pickBand(cfg.occupancyBands, forwardOccupancy);
  return 1 + (raw - 1) * cfg.occupancyWeight;
}

export function leadTimeMultiplier(days: number, cfg: PricingConfig): number {
  return pickBand(cfg.leadTimeBands, days);
}

/** Last-minute discount applies only to nights that are still open. */
export function lastMinuteMultiplier(days: number, isOpen: boolean, cfg: PricingConfig): number {
  if (!isOpen) return 1;
  return pickBand(cfg.lastMinuteBands, days);
}
