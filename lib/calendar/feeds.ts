import { parseICS } from "../ical";
import { dateRange } from "../dates";
import type { AvailabilityStatus } from "../pricing/occupancy";
import type { ThinBooking } from "./ingest";

/** Raw ICS text pulled from one OTA, or the reason it could not be pulled. */
export interface RawFeed {
  source: string;
  ics: string | null;
  error?: string;
}

/** What happened with one source — surfaced in the UI so a silent gap is impossible. */
export interface FeedReport {
  source: string;
  ok: boolean;
  /** nights this source contributed (0 when it failed) */
  nights: number;
  booked: number;
  blocked: number;
  error?: string;
}

export interface SourcedBooking extends ThinBooking {
  source: string;
  status: AvailabilityStatus;
}

export interface MergedFeeds {
  /**
   * Plain object rather than a Map: this crosses the server→client boundary,
   * and a Map is not serializable in React Server Components.
   */
  statusByDate: Record<string, AvailabilityStatus>;
  bookings: SourcedBooking[];
  perSource: FeedReport[];
}

/**
 * Classify an iCal event summary as a real reservation vs. an owner/channel block.
 *
 * This distinction is load-bearing, not cosmetic: `forwardOccupancy` counts booked
 * nights in the numerator but drops blocked nights from the denominator entirely.
 * Marking a block as "booked" invents demand that does not exist and pushes prices up.
 *
 * Observed in the live feeds:
 *   Airbnb  → "Reserved" (a real booking) vs "Airbnb (Not available)" (a block)
 *   Booking → only ever "CLOSED - Not available" — genuinely ambiguous, so it is
 *             treated as a block: the conservative choice, since that keeps it out
 *             of the occupancy signal rather than fabricating demand.
 */
export function classifySummary(summary: string): AvailabilityStatus {
  const s = summary.toLowerCase();
  if (s.includes("not available") || s.includes("closed") || s.includes("blocked")) {
    return "blocked";
  }
  if (s.includes("reserved") || s.includes("booked") || s.includes("reservation")) {
    return "booked";
  }
  // Unknown wording: assume a real booking, since an unexplained busy night on an
  // OTA calendar is far more often a reservation than an owner block.
  return "booked";
}

/** A real reservation outranks a block when two sources disagree about a night. */
function strongerStatus(a: AvailabilityStatus, b: AvailabilityStatus): AvailabilityStatus {
  if (a === "booked" || b === "booked") return "booked";
  return "blocked";
}

/**
 * Merge several OTA feeds into one availability picture.
 *
 * Pure and total — it never throws and never lets one bad source lose the others.
 * A feed that failed upstream (`ics: null`) or fails to parse is reported as not-ok
 * and simply contributes nothing.
 */
export function mergeFeeds(feeds: RawFeed[]): MergedFeeds {
  const statusByDate: Record<string, AvailabilityStatus> = {};
  const bookings: SourcedBooking[] = [];
  const perSource: FeedReport[] = [];

  for (const feed of feeds) {
    if (feed.ics === null) {
      perSource.push({
        source: feed.source,
        ok: false,
        nights: 0,
        booked: 0,
        blocked: 0,
        error: feed.error ?? "no data",
      });
      continue;
    }

    try {
      const events = parseICS(feed.ics);
      let booked = 0;
      let blocked = 0;
      const nights = new Set<string>();

      for (const ev of events) {
        const status = classifySummary(ev.summary);
        bookings.push({
          source: feed.source,
          status,
          externalUid: ev.uid,
          checkIn: ev.startDate,
          checkOut: ev.endDate,
          rawLabel: ev.summary,
        });
        for (const date of dateRange(ev.startDate, ev.endDate)) {
          nights.add(date);
          const prev = statusByDate[date];
          statusByDate[date] = prev ? strongerStatus(prev, status) : status;
        }
      }

      for (const date of nights) {
        if (statusByDate[date] === "booked") booked++;
        else blocked++;
      }

      perSource.push({ source: feed.source, ok: true, nights: nights.size, booked, blocked });
    } catch (e) {
      perSource.push({
        source: feed.source,
        ok: false,
        nights: 0,
        booked: 0,
        blocked: 0,
        error: e instanceof Error ? e.message : "unreadable calendar",
      });
    }
  }

  return { statusByDate, bookings, perSource };
}

/** Rebuild the Map the pricing engine expects from the serialized record. */
export function toStatusMap(
  record: Record<string, AvailabilityStatus>,
): Map<string, AvailabilityStatus> {
  return new Map(Object.entries(record));
}
