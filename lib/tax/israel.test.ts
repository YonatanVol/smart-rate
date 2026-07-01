import { test } from "node:test";
import assert from "node:assert/strict";
import { applyVat } from "./israel";

test("Israeli guest: 18% VAT split out of a gross price", () => {
  const r = applyVat(118, "israeli");
  assert.equal(r.rateApplied, 0.18);
  assert.ok(Math.abs(r.netOfVat - 100) < 1e-9);
  assert.ok(Math.abs(r.vat - 18) < 1e-9);
  assert.equal(r.verify, false);
});

test("Foreign tourist: zero-rated, net equals gross (provisional)", () => {
  const r = applyVat(118, "foreign_tourist");
  assert.equal(r.rateApplied, 0);
  assert.equal(r.netOfVat, 118);
  assert.equal(r.vat, 0);
  assert.equal(r.verify, true);
});
