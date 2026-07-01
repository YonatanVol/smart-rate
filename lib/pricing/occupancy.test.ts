import { test } from "node:test";
import assert from "node:assert/strict";
import { forwardOccupancy, addDaysStr, type AvailabilityStatus } from "./occupancy";

function m(entries: [string, AvailabilityStatus][]): Map<string, AvailabilityStatus> {
  return new Map(entries);
}

test("addDaysStr crosses month boundaries", () => {
  assert.equal(addDaysStr("2026-07-30", 3), "2026-08-02");
  assert.equal(addDaysStr("2026-12-31", 1), "2027-01-01");
});

test("forward occupancy = booked / sellable over the window", () => {
  const map = m([
    ["2026-07-01", "booked"],
    ["2026-07-02", "booked"],
    ["2026-07-03", "open"],
    ["2026-07-04", "open"],
  ]);
  assert.equal(forwardOccupancy(map, "2026-07-01", 4), 0.5); // 2 booked / 4 sellable
});

test("blocked nights are excluded from the denominator", () => {
  const map = m([
    ["2026-07-01", "booked"],
    ["2026-07-02", "blocked"],
    ["2026-07-03", "open"],
  ]);
  // sellable = 2 (07-01 booked + 07-03 open); 07-02 blocked is dropped
  assert.equal(forwardOccupancy(map, "2026-07-01", 3), 0.5);
});

test("unknown dates count as open (sellable, not booked) → cold-start is 0", () => {
  assert.equal(forwardOccupancy(new Map(), "2026-07-01", 10), 0);
});

test("a fully booked window reads as 1", () => {
  const map = m([
    ["2026-08-01", "booked"],
    ["2026-08-02", "booked"],
  ]);
  assert.equal(forwardOccupancy(map, "2026-08-01", 2), 1);
});
