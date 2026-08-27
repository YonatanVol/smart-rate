import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeFeeds, classifySummary, toStatusMap } from "./feeds";

function ics(events: Array<[string, string, string]>): string {
  const body = events
    .map(
      ([start, end, summary], i) =>
        `BEGIN:VEVENT\r\nUID:evt-${i}@test\r\nDTSTART;VALUE=DATE:${start}\r\nDTEND;VALUE=DATE:${end}\r\nSUMMARY:${summary}\r\nEND:VEVENT`,
    )
    .join("\r\n");
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//test//EN\r\n${body}\r\nEND:VCALENDAR\r\n`;
}

test("classifies a reservation as booked and a channel block as blocked", () => {
  assert.equal(classifySummary("Reserved"), "booked");
  assert.equal(classifySummary("Airbnb (Not available)"), "blocked");
  assert.equal(classifySummary("CLOSED - Not available"), "blocked");
  assert.equal(classifySummary("Blocked"), "blocked");
});

test("merges two feeds into one status map, DTEND exclusive", () => {
  const merged = mergeFeeds([
    { source: "airbnb", ics: ics([["20260701", "20260704", "Reserved"]]) },
    { source: "booking", ics: ics([["20260710", "20260712", "CLOSED - Not available"]]) },
  ]);
  // 1-3 July booked; the 4th (checkout day) stays sellable.
  assert.equal(merged.statusByDate["2026-07-01"], "booked");
  assert.equal(merged.statusByDate["2026-07-03"], "booked");
  assert.equal(merged.statusByDate["2026-07-04"], undefined);
  // Booking's ambiguous wording is kept out of the occupancy signal.
  assert.equal(merged.statusByDate["2026-07-10"], "blocked");
  assert.equal(merged.statusByDate["2026-07-11"], "blocked");
  assert.equal(merged.perSource.length, 2);
  assert.ok(merged.perSource.every((s) => s.ok));
});

test("a failed source is isolated and reported, the other still lands", () => {
  const merged = mergeFeeds([
    { source: "airbnb", ics: null, error: "HTTP 503" },
    { source: "booking", ics: ics([["20260801", "20260803", "Reserved"]]) },
  ]);
  const airbnb = merged.perSource.find((s) => s.source === "airbnb")!;
  const booking = merged.perSource.find((s) => s.source === "booking")!;
  assert.equal(airbnb.ok, false);
  assert.equal(airbnb.error, "HTTP 503");
  assert.equal(booking.ok, true);
  assert.equal(merged.statusByDate["2026-08-01"], "booked");
});

test("overlapping nights across sources are not double-counted", () => {
  const merged = mergeFeeds([
    { source: "airbnb", ics: ics([["20260901", "20260904", "Reserved"]]) },
    { source: "booking", ics: ics([["20260902", "20260905", "CLOSED - Not available"]]) },
  ]);
  const nights = Object.keys(merged.statusByDate);
  assert.equal(nights.length, 4); // 1,2,3,4 — not 6
  assert.equal(merged.bookings.length, 2);
});

test("a real reservation outranks a block when sources disagree", () => {
  const merged = mergeFeeds([
    { source: "booking", ics: ics([["20261001", "20261002", "CLOSED - Not available"]]) },
    { source: "airbnb", ics: ics([["20261001", "20261002", "Reserved"]]) },
  ]);
  assert.equal(merged.statusByDate["2026-10-01"], "booked");
});

test("unreadable ICS degrades safely instead of throwing", () => {
  const merged = mergeFeeds([
    { source: "airbnb", ics: "this is not a calendar" },
    { source: "booking", ics: ics([["20261101", "20261102", "Reserved"]]) },
  ]);
  const airbnb = merged.perSource.find((s) => s.source === "airbnb")!;
  assert.equal(airbnb.ok, false);
  assert.ok(airbnb.error);
  assert.equal(merged.statusByDate["2026-11-01"], "booked");
});

test("no feeds configured yields an empty but valid result", () => {
  const merged = mergeFeeds([]);
  assert.deepEqual(merged.statusByDate, {});
  assert.deepEqual(merged.perSource, []);
  assert.equal(toStatusMap(merged.statusByDate).size, 0);
});

test("toStatusMap rebuilds the Map the pricing engine expects", () => {
  const merged = mergeFeeds([
    { source: "airbnb", ics: ics([["20261201", "20261203", "Reserved"]]) },
  ]);
  const map = toStatusMap(merged.statusByDate);
  assert.equal(map.get("2026-12-01"), "booked");
  assert.equal(map.get("2026-12-02"), "booked");
  assert.equal(map.get("2026-12-03"), undefined);
});
