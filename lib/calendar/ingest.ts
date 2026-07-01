import { parseICS, expandEvents } from "../ical";
import type { AvailabilityStatus } from "../pricing/occupancy";

/** A thin booking derived from an OTA feed: no guest/price, just the blocked span. */
export interface ThinBooking {
  externalUid: string;
  checkIn: string; // "YYYY-MM-DD" inclusive
  checkOut: string; // "YYYY-MM-DD" EXCLUSIVE (iCal DTEND)
  rawLabel: string;
}

export interface IngestResult {
  bookedDates: Set<string>;
  bookings: ThinBooking[];
}

/**
 * Parse an OTA iCal feed into the two things smart-rate needs: the set of booked
 * nights (feeds occupancy + availability) and thin bookings (feeds the calendar).
 * Pure — the DB upsert is a thin layer on top. iCal carries no guest/price/rate.
 */
export function ingestICal(icsText: string): IngestResult {
  const events = parseICS(icsText);
  const bookedDates = new Set<string>();
  for (const d of expandEvents(events)) bookedDates.add(d.date);
  const bookings = events.map((e) => ({
    externalUid: e.uid,
    checkIn: e.startDate,
    checkOut: e.endDate,
    rawLabel: e.summary,
  }));
  return { bookedDates, bookings };
}

/** Build a per-night status map (feed-booked nights → "booked"; the rest stay open). */
export function statusMapFromBooked(bookedDates: Iterable<string>): Map<string, AvailabilityStatus> {
  const m = new Map<string, AvailabilityStatus>();
  for (const d of bookedDates) m.set(d, "booked");
  return m;
}
