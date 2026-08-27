import { test } from "node:test";
import assert from "node:assert/strict";
import { computePrice } from "./engine";
import { explainPrice } from "./waterfall";

const input = {
  basePrice: 550,
  leadTimeDays: 20,
  forwardOccupancy: 0.5,
  isOpen: true,
  floor: 200,
  ceiling: 1600,
};

test("base plus every delta equals the subtotal, exactly", () => {
  for (const day of [1, 2, 3, 4, 5, 10, 25, 26]) {
    const w = explainPrice(computePrice({ ...input, date: new Date(2026, 8, day) }));
    const summed = w.base + w.steps.reduce((a, s) => a + s.delta, 0);
    assert.equal(summed, w.subtotal, `deltas must sum on 2026-09-${day}`);
  }
});

test("an unclamped night's subtotal is the recommended price", () => {
  const w = explainPrice(computePrice({ ...input, date: new Date(2026, 8, 25) }));
  assert.equal(w.clampedBy, null);
  assert.equal(w.clampDelta, 0);
  assert.equal(w.subtotal, w.recommended);
});

test("a clamped night reports the clamp as its own step", () => {
  const w = explainPrice(
    computePrice({ ...input, basePrice: 5000, ceiling: 1200, date: new Date(2026, 8, 25) }),
  );
  assert.equal(w.clampedBy, "ceiling");
  assert.equal(w.recommended, 1200);
  assert.equal(w.subtotal + w.clampDelta, 1200);
  assert.ok(w.clampDelta < 0);
});

test("every factor is represented, in engine order", () => {
  const w = explainPrice(computePrice({ ...input, date: new Date(2026, 8, 25) }));
  assert.deepEqual(
    w.steps.map((s) => s.key),
    ["season", "dow", "leadTime", "occupancy", "event", "lastMinute"],
  );
});

test("a neutral factor contributes zero shekels", () => {
  const w = explainPrice(computePrice({ ...input, isOpen: false, date: new Date(2026, 8, 22) }));
  const lastMinute = w.steps.find((s) => s.key === "lastMinute")!;
  assert.equal(lastMinute.multiplier, 1);
  assert.equal(lastMinute.delta, 0);
});
