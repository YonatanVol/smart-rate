import { test } from "node:test";
import assert from "node:assert/strict";
import { recommendRange, type UnitEconomics } from "./recommend";
import type { AvailabilityStatus } from "./occupancy";

const unit: UnitEconomics = { basePrice: 500, variableCost: 200, minMargin: 100, ceiling: 2000 };

test("produces one recommendation per requested night, in order", () => {
  const recs = recommendRange({
    unit,
    statusByDate: new Map(),
    today: "2026-06-01",
    from: "2026-07-01",
    nights: 7,
  });
  assert.equal(recs.length, 7);
  assert.equal(recs[0].date, "2026-07-01");
  assert.equal(recs[6].date, "2026-07-07");
});

test("floor = variable cost + min margin clamps cheap nights", () => {
  const cheap: UnitEconomics = { basePrice: 100, variableCost: 250, minMargin: 100, ceiling: 2000 };
  const recs = recommendRange({
    unit: cheap,
    statusByDate: new Map(),
    today: "2026-06-01",
    from: "2027-01-13",
    nights: 1,
  });
  assert.equal(recs[0].breakdown.floor, 350);
  assert.equal(recs[0].breakdown.recommended, 350);
  assert.equal(recs[0].breakdown.clampedBy, "floor");
});

test("last-minute discount hits an open near night but not a booked one", () => {
  const map = new Map<string, AvailabilityStatus>([["2026-06-03", "booked"]]);
  const recs = recommendRange({
    unit,
    statusByDate: map,
    today: "2026-06-01",
    from: "2026-06-02",
    nights: 2,
  });
  // 2026-06-02 open, 1 day out → last-minute < 1; 2026-06-03 booked → no discount
  assert.ok(recs[0].breakdown.multipliers.lastMinute < 1);
  assert.equal(recs[1].breakdown.multipliers.lastMinute, 1);
});

test("a manual event lifts the price on covered dates", () => {
  const args = {
    unit,
    statusByDate: new Map<string, AvailabilityStatus>(),
    today: "2026-06-01",
    from: "2026-11-10",
    nights: 1,
  };
  const base = recommendRange(args)[0];
  const withEvent = recommendRange({
    ...args,
    events: [{ startDate: "2026-11-10", endDate: "2026-11-10", multiplier: 1.5 }],
  })[0];
  assert.ok(withEvent.breakdown.multipliers.event >= 1.5);
  assert.ok(withEvent.breakdown.recommended > base.breakdown.recommended);
});

test("high forward occupancy prices above an empty calendar", () => {
  const full = new Map<string, AvailabilityStatus>();
  for (let i = 0; i < 30; i++) {
    const d = `2026-09-${String(i + 1).padStart(2, "0")}`;
    if (i < 30) full.set(d, "booked");
  }
  const busy = recommendRange({
    unit,
    statusByDate: full,
    today: "2026-06-01",
    from: "2026-09-01",
    nights: 1,
  })[0];
  const quiet = recommendRange({
    unit,
    statusByDate: new Map(),
    today: "2026-06-01",
    from: "2026-09-01",
    nights: 1,
  })[0];
  assert.ok(busy.breakdown.multipliers.occupancy > quiet.breakdown.multipliers.occupancy);
});
