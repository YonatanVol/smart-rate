import type { HolidayTier } from "../calendar/hebcal";

export interface Band {
  /** inclusive upper bound for this band */
  upTo: number;
  mult: number;
}

export interface PricingConfig {
  /** day-of-week multipliers, index 0=Sunday … 6=Saturday (JS getDay) */
  dow: [number, number, number, number, number, number, number];
  /** seasonal multipliers, index 0=January … 11=December */
  seasonByMonth: [
    number, number, number, number, number, number,
    number, number, number, number, number, number,
  ];
  /** event multiplier per Hebrew-holiday tier */
  eventTier: Record<HolidayTier, number>;
  /** forward-occupancy bands (occupancy 0..1), ascending by upTo */
  occupancyBands: Band[];
  /** 0..1 — weight given to occupancy (low in cold-start, grows with own history) */
  occupancyWeight: number;
  /** lead-time bands (days until check-in), ascending by upTo */
  leadTimeBands: Band[];
  /** last-minute discount bands (days until check-in), applied only to still-open nights */
  lastMinuteBands: Band[];
}

/**
 * Israel-first defaults.
 *
 * The day-of-week profile is the product wedge: Thursday + Friday (Shabbat eve)
 * are the leisure peak, and Saturday SOFTENS as the Sunday work-week begins —
 * NOT the Western Fri/Sat weekend. Every field is tunable per property.
 */
export const DEFAULT_CONFIG_IL: PricingConfig = {
  //    Sun   Mon   Tue   Wed   Thu   Fri   Sat
  dow: [0.95, 0.92, 0.92, 0.95, 1.15, 1.25, 1.0],
  //             Jan   Feb   Mar   Apr   May   Jun   Jul   Aug   Sep   Oct   Nov   Dec
  seasonByMonth: [0.85, 0.85, 0.95, 1.15, 1.0, 1.05, 1.2, 1.25, 1.1, 1.05, 0.9, 0.95],
  eventTier: { major: 1.5, cholHamoed: 1.4, modern: 1.25, minor: 1.12, none: 1.0 },
  occupancyBands: [
    { upTo: 0.3, mult: 0.92 },
    { upTo: 0.6, mult: 1.0 },
    { upTo: 0.8, mult: 1.08 },
    { upTo: 1.0, mult: 1.18 },
  ],
  occupancyWeight: 0.3,
  leadTimeBands: [
    { upTo: 7, mult: 1.0 }, // near-term handled mostly by last-minute
    { upTo: 30, mult: 1.03 },
    { upTo: 90, mult: 1.0 },
    { upTo: Infinity, mult: 0.97 }, // early-bird slight discount
  ],
  lastMinuteBands: [
    { upTo: 3, mult: 0.85 },
    { upTo: 7, mult: 0.93 },
    { upTo: Infinity, mult: 1.0 },
  ],
};
