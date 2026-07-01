import { test } from "node:test";
import assert from "node:assert/strict";
import { addDaysStr, daysBetween, dateRange } from "./dates";

test("addDaysStr crosses month and year boundaries", () => {
  assert.equal(addDaysStr("2026-07-30", 3), "2026-08-02");
  assert.equal(addDaysStr("2026-12-31", 1), "2027-01-01");
});

test("daysBetween is signed", () => {
  assert.equal(daysBetween("2026-07-01", "2026-07-08"), 7);
  assert.equal(daysBetween("2026-07-08", "2026-07-01"), -7);
});

test("dateRange is inclusive-start / exclusive-end (iCal DATE semantics)", () => {
  assert.deepEqual(dateRange("2026-07-02", "2026-07-05"), ["2026-07-02", "2026-07-03", "2026-07-04"]);
  assert.deepEqual(dateRange("2026-07-05", "2026-07-05"), []);
  assert.deepEqual(dateRange("2026-07-05", "2026-07-04"), []);
});
