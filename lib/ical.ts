import ICAL from "ical.js";
import { dateRange } from "./dates";

export interface CalendarEvent {
  uid: string;
  summary: string;
  startDate: string; // "YYYY-MM-DD" inclusive
  endDate: string; // "YYYY-MM-DD" EXCLUSIVE (iCal DATE semantics; checkout day free)
}

/** Fetch and parse an OTA iCal URL into calendar events. */
export async function fetchCalendar(url: string): Promise<CalendarEvent[]> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch calendar: ${res.status}`);
  return parseICS(await res.text());
}

/** Parse raw ICS text into calendar events. Pure — no I/O. */
export function parseICS(icsText: string): CalendarEvent[] {
  const jcal = ICAL.parse(icsText);
  const comp = new ICAL.Component(jcal);
  return comp.getAllSubcomponents("vevent").map((vevent) => {
    const event = new ICAL.Event(vevent);
    const s = event.startDate;
    const e = event.endDate;
    return {
      uid: event.uid || "",
      summary: event.summary || "Blocked",
      startDate: `${s.year}-${String(s.month).padStart(2, "0")}-${String(s.day).padStart(2, "0")}`,
      endDate: `${e.year}-${String(e.month).padStart(2, "0")}-${String(e.day).padStart(2, "0")}`,
    };
  });
}

/** Expand events into individual blocked nights ("YYYY-MM-DD"). */
export function expandEvents(
  events: CalendarEvent[],
): Array<{ date: string; uid: string; summary: string }> {
  const out: Array<{ date: string; uid: string; summary: string }> = [];
  for (const ev of events) {
    for (const date of dateRange(ev.startDate, ev.endDate)) {
      out.push({ date, uid: ev.uid, summary: ev.summary });
    }
  }
  return out;
}

function escapeICalText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function formatICalStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

interface OutEvent {
  uid: string;
  summary: string;
  start: string; // "YYYY-MM-DD" inclusive
  end: string; // "YYYY-MM-DD" EXCLUSIVE
}

/**
 * Build a valid VCALENDAR (RFC 5545) of all-day blocked ranges with CRLF line
 * endings, DTEND exclusive. This is the feed smart-rate exposes so Airbnb/Booking
 * can import the owner's manual blocks (availability out; rates stay manual).
 */
export function generateICalendar(
  events: OutEvent[],
  opts: { prodId?: string; calName?: string; now?: Date } = {},
): string {
  const prodId = opts.prodId ?? "-//smart-rate//Availability//EN";
  const dtstamp = formatICalStamp(opts.now ?? new Date());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:${prodId}`, "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  if (opts.calName) lines.push(`X-WR-CALNAME:${escapeICalText(opts.calName)}`);
  for (const ev of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${ev.start.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${ev.end.replace(/-/g, "")}`,
      `SUMMARY:${escapeICalText(ev.summary)}`,
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
