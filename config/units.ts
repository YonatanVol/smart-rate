import type { UnitEconomics } from "@/lib/pricing/recommend";

export type OtaSource = "airbnb" | "booking" | "vrbo";

export interface FeedConfig {
  source: OtaSource;
  /**
   * Name of the env var holding the iCal URL. The URL itself carries an access
   * token, so it never belongs in the repo — only the variable name does.
   */
  urlEnv: string;
}

/** Shaped 1:1 onto the `units` table so Milestone B seeds straight from this. */
export interface UnitConfig {
  id: string;
  name: string;
  city: string;
  economics: UnitEconomics;
  feeds: FeedConfig[];
}

/**
 * A list from day one even though only one unit exists — adding the second is
 * then data, not a refactor.
 */
export const UNITS: UnitConfig[] = [
  {
    id: "jaffa",
    name: "דירת יפו",
    city: "תל אביב–יפו",
    economics: {
      basePrice: 550,
      variableCost: 120,
      minMargin: 80,
      ceiling: 1600,
    },
    feeds: [
      { source: "airbnb", urlEnv: "ICAL_AIRBNB_URL" },
      { source: "booking", urlEnv: "ICAL_BOOKING_URL" },
    ],
  },
];

export function getUnit(id: string): UnitConfig | undefined {
  return UNITS.find((u) => u.id === id);
}
