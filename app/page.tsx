import { Frank_Ruhl_Libre } from "next/font/google";
import { computePrice } from "@/lib/pricing/engine";
import { DEFAULT_CONFIG_IL } from "@/lib/pricing/config";
import { explainPrice } from "@/lib/pricing/waterfall";
import { addDaysStr, todayInTimeZone } from "@/lib/dates";
import { UNITS } from "@/config/units";
import Landing from "./landing";

// A Hebrew serif for marketing display only; the app itself stays on Assistant.
const frank = Frank_Ruhl_Libre({
  subsets: ["hebrew", "latin"],
  weight: ["500", "700"],
  variable: "--font-frank",
  display: "swap",
});

const BASE = UNITS[0].economics.basePrice;
const SEASON_MONTH = 8; // September — the Tishrei high season the example sits in

/**
 * Find the next Sukkot eve and price it for real.
 *
 * The landing page shows engine output, not invented numbers. Anchoring on a
 * named holiday rather than "the priciest night in the next year" also keeps the
 * example off fast days, which the tier map still misreads as demand peaks.
 */
function findExampleNight() {
  const today = todayInTimeZone();
  const economics = UNITS[0].economics;
  for (let i = 0; i < 400; i++) {
    const date = addDaysStr(today, i);
    const breakdown = computePrice({
      basePrice: economics.basePrice,
      date: new Date(date + "T12:00:00"),
      leadTimeDays: i,
      forwardOccupancy: 0.5,
      isOpen: true,
      floor: economics.variableCost + economics.minMargin,
      ceiling: economics.ceiling ?? economics.basePrice * 4,
    });
    if (breakdown.holidayNames.some((n) => n.includes("ערב סוכות"))) {
      return { date, breakdown };
    }
  }
  return null;
}

export default function Home() {
  const example = findExampleNight();
  const waterfall = example ? explainPrice(example.breakdown) : null;

  // The real Israeli day-of-week curve, at a high-season month, so the chart on
  // the page and the engine behind it can never drift apart.
  const week = DEFAULT_CONFIG_IL.dow.map((m) =>
    Math.round(BASE * DEFAULT_CONFIG_IL.seasonByMonth[SEASON_MONTH] * m),
  );

  // Saturday's multiplier is 1.0, so this is the "no day-of-week adjustment"
  // level — the honest reference the chart measures against.
  const neutral = Math.round(BASE * DEFAULT_CONFIG_IL.seasonByMonth[SEASON_MONTH]);

  return (
    <div className={frank.variable}>
      <Landing
        week={week}
        neutral={neutral}
        peakDows={[4, 5]}
        example={
          example && waterfall
            ? {
                date: example.date,
                holiday: example.breakdown.holidayNames[0] ?? "",
                recommended: example.breakdown.recommended,
                base: waterfall.base,
                steps: waterfall.steps.map((s) => ({ key: s.key, delta: s.delta })),
              }
            : null
        }
      />
    </div>
  );
}
