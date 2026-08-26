import type { PriceBreakdown } from "./engine";

export type FactorKey = keyof PriceBreakdown["multipliers"];

export interface WaterfallStep {
  key: FactorKey;
  multiplier: number;
  /** whole shekels this factor added or removed */
  delta: number;
  /** price after this factor */
  runningTotal: number;
}

export interface Waterfall {
  base: number;
  steps: WaterfallStep[];
  /** base + every delta — equals the rounded pre-clamp price, exactly */
  subtotal: number;
  /** shekels the floor/ceiling moved it, 0 when unclamped */
  clampDelta: number;
  clampedBy: "floor" | "ceiling" | null;
  recommended: number;
}

/** The order the engine applies them in; the decomposition must mirror it. */
const ORDER: FactorKey[] = ["season", "dow", "leadTime", "occupancy", "event", "lastMinute"];

/**
 * Turn a multiplicative breakdown into per-factor amounts in shekels.
 *
 * "×1.15" tells an owner nothing; "+₪151 because it's a Friday" does. Deltas are
 * derived from *rounded* running totals rather than rounded independently, so
 * base + every delta always equals the subtotal exactly — a waterfall whose
 * numbers do not add up is worse than no waterfall.
 */
export function explainPrice(b: PriceBreakdown): Waterfall {
  const steps: WaterfallStep[] = [];
  let exact = b.base;
  let prevRounded = Math.round(b.base);

  for (const key of ORDER) {
    exact *= b.multipliers[key];
    const rounded = Math.round(exact);
    steps.push({
      key,
      multiplier: b.multipliers[key],
      delta: rounded - prevRounded,
      runningTotal: rounded,
    });
    prevRounded = rounded;
  }

  return {
    base: Math.round(b.base),
    steps,
    subtotal: prevRounded,
    clampDelta: b.recommended - prevRounded,
    clampedBy: b.clampedBy,
    recommended: b.recommended,
  };
}
