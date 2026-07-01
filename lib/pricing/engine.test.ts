import { test } from "node:test";
import assert from "node:assert/strict";
import { computePrice } from "./engine";

const baseInput = {
  basePrice: 500,
  leadTimeDays: 45,
  forwardOccupancy: 0.5,
  isOpen: true,
  floor: 300,
  ceiling: 2000,
};

test("Passover (major holiday) lifts the price above a plain weekday", () => {
  // 2026-04-02 = 15 Nisan 5786 = Pesach I (major)
  const passover = computePrice({ ...baseInput, date: new Date(2026, 3, 2) });
  // 2026-03-18 = ordinary Wednesday, no holiday
  const ordinary = computePrice({ ...baseInput, date: new Date(2026, 2, 18) });
  assert.ok(passover.multipliers.event > 1, "event multiplier should apply on Pesach");
  assert.ok(passover.recommended > ordinary.recommended);
  assert.ok(passover.holidayNames.some((n) => /Pesach/i.test(n)));
});

test("Friday night prices higher than Wednesday night (Israeli week shape)", () => {
  const fri = computePrice({ ...baseInput, date: new Date(2026, 6, 3) }); // Fri 2026-07-03
  const wed = computePrice({ ...baseInput, date: new Date(2026, 6, 1) }); // Wed 2026-07-01
  assert.ok(fri.multipliers.dow > wed.multipliers.dow);
});

test("Saturday softens relative to Friday (not a Western weekend)", () => {
  const fri = computePrice({ ...baseInput, date: new Date(2026, 6, 3) }); // Fri
  const sat = computePrice({ ...baseInput, date: new Date(2026, 6, 4) }); // Sat
  assert.ok(sat.multipliers.dow < fri.multipliers.dow);
});

test("floor clamp: a cheap night never drops below variable cost + margin", () => {
  const r = computePrice({ ...baseInput, basePrice: 100, floor: 350, date: new Date(2026, 0, 13) });
  assert.equal(r.clampedBy, "floor");
  assert.equal(r.recommended, 350);
});

test("ceiling clamp: a hot night never exceeds the owner ceiling", () => {
  const r = computePrice({ ...baseInput, basePrice: 5000, ceiling: 1200, date: new Date(2026, 3, 2) });
  assert.equal(r.clampedBy, "ceiling");
  assert.equal(r.recommended, 1200);
});

test("cold-start: zero occupancy weight keeps occupancy neutral", () => {
  const r = computePrice({
    ...baseInput,
    forwardOccupancy: 0.95,
    config: { occupancyWeight: 0 },
    date: new Date(2026, 6, 1),
  });
  assert.equal(r.multipliers.occupancy, 1);
});

test("last-minute discount applies only to still-open nights", () => {
  const open = computePrice({ ...baseInput, leadTimeDays: 2, isOpen: true, date: new Date(2026, 6, 1) });
  const booked = computePrice({ ...baseInput, leadTimeDays: 2, isOpen: false, date: new Date(2026, 6, 1) });
  assert.ok(open.multipliers.lastMinute < 1);
  assert.equal(booked.multipliers.lastMinute, 1);
});

test("deterministic: same input → same output", () => {
  const a = computePrice({ ...baseInput, date: new Date(2026, 6, 1) });
  const b = computePrice({ ...baseInput, date: new Date(2026, 6, 1) });
  assert.deepEqual(a, b);
});
