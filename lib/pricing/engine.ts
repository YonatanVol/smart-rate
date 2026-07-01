import { DEFAULT_CONFIG_IL, type PricingConfig } from "./config";
import {
  dowMultiplier,
  eventMultiplier,
  lastMinuteMultiplier,
  leadTimeMultiplier,
  occupancyMultiplier,
  seasonMultiplier,
} from "./multipliers";

export interface PriceInput {
  basePrice: number;
  /** the night being priced */
  date: Date;
  /** days until check-in */
  leadTimeDays: number;
  /** forward occupancy of a comparable window, 0..1 */
  forwardOccupancy: number;
  /** is the night still available (gates the last-minute discount) */
  isOpen: boolean;
  /** multiplier (>=1) from the manual events table covering this date */
  manualEventMultiplier?: number;
  /** floor = variable cost + minimum margin */
  floor: number;
  /** owner-set ceiling */
  ceiling: number;
  /** partial overrides on the default Israeli config */
  config?: Partial<PricingConfig>;
}

export interface PriceBreakdown {
  base: number;
  multipliers: {
    season: number;
    dow: number;
    leadTime: number;
    occupancy: number;
    event: number;
    lastMinute: number;
  };
  raw: number;
  recommended: number;
  floor: number;
  ceiling: number;
  clampedBy: "floor" | "ceiling" | null;
  holidayNames: string[];
}

/**
 * Transparent, multiplicative v1 pricing — deterministic and explainable.
 * No competitor data: prices off seasonality, the Israeli week shape, the
 * Hebrew calendar, events, and the unit's own forward occupancy.
 */
export function computePrice(input: PriceInput): PriceBreakdown {
  const cfg: PricingConfig = { ...DEFAULT_CONFIG_IL, ...input.config };

  const season = seasonMultiplier(input.date, cfg);
  const dow = dowMultiplier(input.date, cfg);
  const leadTime = leadTimeMultiplier(input.leadTimeDays, cfg);
  const occupancy = occupancyMultiplier(input.forwardOccupancy, cfg);
  const evt = eventMultiplier(input.date, cfg, input.manualEventMultiplier ?? 1);
  const lastMinute = lastMinuteMultiplier(input.leadTimeDays, input.isOpen, cfg);

  const raw =
    input.basePrice * season * dow * leadTime * occupancy * evt.mult * lastMinute;

  let recommended = Math.round(raw);
  let clampedBy: "floor" | "ceiling" | null = null;
  if (recommended < input.floor) {
    recommended = Math.round(input.floor);
    clampedBy = "floor";
  } else if (recommended > input.ceiling) {
    recommended = Math.round(input.ceiling);
    clampedBy = "ceiling";
  }

  return {
    base: input.basePrice,
    multipliers: { season, dow, leadTime, occupancy, event: evt.mult, lastMinute },
    raw,
    recommended,
    floor: input.floor,
    ceiling: input.ceiling,
    clampedBy,
    holidayNames: evt.holidayNames,
  };
}
