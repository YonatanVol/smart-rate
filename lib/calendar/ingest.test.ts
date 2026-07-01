import { test } from "node:test";
import assert from "node:assert/strict";
import { ingestICal, statusMapFromBooked } from "./ingest";
import { recommendRange, type UnitEconomics } from "../pricing/recommend";

// Airbnb-style feed: one reservation, DTEND exclusive (checkout day stays free).
const SAMPLE = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Airbnb Inc//Hosting Calendar//EN",
  "CALSCALE:GREGORIAN",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20260702",
  "DTEND;VALUE=DATE:20260705",
  "UID:abc123@airbnb.com",
  "SUMMARY:Reserved",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

test("ingest maps a reservation to booked nights (DTEND exclusive)", () => {
  const { bookedDates, bookings } = ingestICal(SAMPLE);
  assert.deepEqual([...bookedDates].sort(), ["2026-07-02", "2026-07-03", "2026-07-04"]);
  assert.equal(bookings.length, 1);
  assert.equal(bookings[0].checkIn, "2026-07-02");
  assert.equal(bookings[0].checkOut, "2026-07-05"); // checkout day is free
  assert.equal(bookings[0].externalUid, "abc123@airbnb.com");
});

test("end-to-end: a booked night reads as not-open and skips the last-minute discount", () => {
  const { bookedDates } = ingestICal(SAMPLE);
  const status = statusMapFromBooked(bookedDates);
  const unit: UnitEconomics = { basePrice: 500, variableCost: 200, minMargin: 100, ceiling: 2000 };
  // Price the reservation window on short notice; booked nights must not be discounted.
  const recs = recommendRange({ unit, statusByDate: status, today: "2026-07-01", from: "2026-07-02", nights: 4 });
  assert.equal(recs[0].breakdown.multipliers.lastMinute, 1); // 07-02 booked
  assert.equal(recs[3].breakdown.multipliers.lastMinute < 1, true); // 07-05 open, near-term
});

test("empty calendar yields no booked nights", () => {
  const empty = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//x//EN",
    "END:VCALENDAR",
  ].join("\r\n");
  assert.equal(ingestICal(empty).bookedDates.size, 0);
});
