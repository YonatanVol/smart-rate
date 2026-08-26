"use client";

import { useMemo, useState } from "react";
import { recommendRange, type UnitEconomics } from "@/lib/pricing/recommend";
import type { AvailabilityStatus } from "@/lib/pricing/occupancy";
import type { PriceBreakdown } from "@/lib/pricing/engine";
import { toStatusMap, type FeedReport } from "@/lib/calendar/feeds";
import { forwardOccupancy } from "@/lib/pricing/occupancy";
import { addDaysStr } from "@/lib/dates";

const WEEKS = 8;
const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];
const MULT_LABELS: Record<string, string> = {
  season: "עונה",
  dow: "יום בשבוע",
  leadTime: "מרחק הזמנה",
  occupancy: "תפוסה",
  event: "אירוע / חג",
  lastMinute: "רגע אחרון",
};

const SOURCE_LABELS: Record<string, string> = {
  airbnb: "Airbnb",
  booking: "Booking.com",
  vrbo: "Vrbo",
};

/** Feeds older than this are called out — OTA iCal refreshes only every few hours. */
const STALE_AFTER_MINUTES = 180;

const addDays = addDaysStr;

function dayOfWeek(s: string): number {
  return new Date(s + "T12:00:00").getDay();
}
function fmtDay(s: string): string {
  const d = new Date(s + "T12:00:00");
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

const inputCls =
  "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none";

export interface RatesClientProps {
  unitName: string;
  economics: UnitEconomics;
  /** Serialized from the server — a Map cannot cross the RSC boundary. */
  statusByDate: Record<string, AvailabilityStatus>;
  perSource: FeedReport[];
  /** ISO timestamp of the fetch, rendered as "last synced". */
  fetchedAt: string;
  /** "YYYY-MM-DD" in Asia/Jerusalem, resolved server-side so SSR and the client agree. */
  today: string;
}

export default function RatesClient({
  unitName,
  economics,
  statusByDate,
  perSource,
  fetchedAt,
  today,
}: RatesClientProps) {
  const [base, setBase] = useState(economics.basePrice);
  const [variableCost, setVariableCost] = useState(economics.variableCost);
  const [minMargin, setMinMargin] = useState(economics.minMargin);
  const [ceiling, setCeiling] = useState(economics.ceiling ?? economics.basePrice * 4);
  const [selected, setSelected] = useState<string | null>(null);

  // First cell = the Sunday on/before today, so weeks line up.
  const gridStart = addDays(today, -dayOfWeek(today));

  const unit: UnitEconomics = useMemo(
    () => ({ basePrice: base, variableCost, minMargin, ceiling }),
    [base, variableCost, minMargin, ceiling],
  );

  // Real availability from the connected OTA calendars.
  const statusMap = useMemo(() => toStatusMap(statusByDate), [statusByDate]);

  const recs = useMemo(() => {
    const all = recommendRange({
      unit,
      statusByDate: statusMap,
      today,
      from: gridStart,
      nights: WEEKS * 7,
    });
    return new Map(all.map((r) => [r.date, r.breakdown]));
  }, [unit, statusMap, today, gridStart]);


  const forward = useMemo(
    () => [...recs.entries()].filter(([d]) => d >= today).map(([, b]) => b),
    [recs, today],
  );
  const stats = useMemo(() => {
    if (!forward.length) return null;
    const prices = forward.map((b) => b.recommended);
    return {
      avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      min: Math.min(...prices),
      max: Math.max(...prices),
      premium: forward.filter((b) => b.recommended > base).length,
      occupancy: forwardOccupancy(statusMap, today, WEEKS * 7),
    };
  }, [forward, base, statusMap, today]);

  const selBreakdown = selected ? recs.get(selected) : null;

  return (
    <main dir="rtl" className="mx-auto w-full max-w-5xl px-6 py-10 text-zinc-900">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">smart-rate · {unitName}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          מחיר מומלץ לכל לילה ל־{WEEKS} השבועות הקרובים — לפי עונתיות, שבוע ישראלי (חמישי־שישי שיא),
          לוח עברי, מרחק הזמנה והתפוסה בפועל מהיומנים המחוברים.
        </p>
      </header>

      <SyncBanner perSource={perSource} fetchedAt={fetchedAt} />

      {/* economics */}
      <section className="mb-5 grid grid-cols-2 gap-3 rounded-xl border border-zinc-200 p-4 sm:grid-cols-4">
        <Field label="מחיר בסיס (₪)"><input type="number" value={base} onChange={(e) => setBase(+e.target.value)} className={inputCls} /></Field>
        <Field label="עלות משתנה (₪)"><input type="number" value={variableCost} onChange={(e) => setVariableCost(+e.target.value)} className={inputCls} /></Field>
        <Field label="מרווח מינימלי (₪)"><input type="number" value={minMargin} onChange={(e) => setMinMargin(+e.target.value)} className={inputCls} /></Field>
        <Field label="תקרה (₪)"><input type="number" value={ceiling} onChange={(e) => setCeiling(+e.target.value)} className={inputCls} /></Field>
        <p className="col-span-2 text-xs text-zinc-400 sm:col-span-4">
          רצפה = עלות משתנה + מרווח = ₪{variableCost + minMargin}. מחיר לעולם לא יורד מתחתיה ולא עולה מעל התקרה.
        </p>
      </section>

      {/* stats */}
      {stats && (
        <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="ממוצע ללילה" value={`₪${stats.avg.toLocaleString()}`} />
          <Stat label="הנמוך ביותר" value={`₪${stats.min.toLocaleString()}`} />
          <Stat label="הגבוה ביותר" value={`₪${stats.max.toLocaleString()}`} />
          <Stat label="לילות בפרמיה" value={`${stats.premium}`} />
          <Stat label="תפוסה קדימה" value={`${Math.round(stats.occupancy * 100)}%`} />
        </section>
      )}

      {/* calendar */}
      <section>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((d, i) => (
            <div key={d} className={`pb-1 text-center text-xs font-medium ${i >= 4 && i <= 5 ? "text-emerald-600" : "text-zinc-400"}`}>
              {d}
            </div>
          ))}
          {Array.from({ length: WEEKS * 7 }, (_, i) => {
            const date = addDays(gridStart, i);
            const b = recs.get(date);
            const past = date < today;
            return (
              <DayCell
                key={date}
                date={date}
                breakdown={b}
                past={past}
                base={base}
                status={statusMap.get(date)}
                selected={date === selected}
                onSelect={() => !past && setSelected(date)}
              />
            );
          })}
        </div>
      </section>

      {/* detail */}
      {selBreakdown && selected && (
        <DetailPanel date={selected} b={selBreakdown} onClose={() => setSelected(null)} />
      )}
    </main>
  );
}

function DayCell({
  date, breakdown, past, base, status, selected, onSelect,
}: {
  date: string;
  breakdown?: PriceBreakdown;
  past: boolean;
  base: number;
  status?: AvailabilityStatus;
  selected: boolean;
  onSelect: () => void;
}) {
  const dayNum = new Date(date + "T12:00:00").getDate();
  if (past || !breakdown) {
    return <div className="min-h-16 rounded-lg bg-zinc-50 p-1.5 text-right text-xs text-zinc-300">{dayNum}</div>;
  }

  // Nights the OTAs already took: the recommendation is informational only, so
  // it stays visible but muted rather than competing with sellable nights.
  if (status === "booked" || status === "blocked") {
    const label = status === "booked" ? "תפוס" : "חסום";
    return (
      <button
        onClick={onSelect}
        className={`min-h-16 rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-1.5 text-right transition ${
          selected ? "ring-2 ring-zinc-800" : "hover:border-zinc-300"
        }`}
      >
        <div className="flex items-start justify-between">
          <span className="text-[11px] text-zinc-400">{dayNum}</span>
          <span className="text-[9px] font-medium text-zinc-400">{label}</span>
        </div>
        <div className="mt-1 text-sm font-medium tabular-nums text-zinc-400">
          ₪{breakdown.recommended.toLocaleString()}
        </div>
      </button>
    );
  }

  const pct = breakdown.recommended / base - 1;
  // Emerald tint for premium nights, faint amber for discounted ones.
  const bg =
    pct >= 0
      ? `rgba(16,185,129,${Math.min(Math.abs(pct) * 1.4, 0.8) * 0.45 + 0.04})`
      : `rgba(245,158,11,${Math.min(Math.abs(pct) * 1.4, 0.8) * 0.3 + 0.03})`;
  const holiday = breakdown.holidayNames.length > 0;
  return (
    <button
      onClick={onSelect}
      style={{ backgroundColor: bg }}
      className={`min-h-16 rounded-lg p-1.5 text-right transition ${
        selected ? "ring-2 ring-zinc-800" : "hover:ring-1 hover:ring-zinc-300"
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="text-[11px] text-zinc-500">{dayNum}</span>
        {holiday && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" title={breakdown.holidayNames.join(" · ")} />}
      </div>
      <div className="mt-1 text-sm font-semibold tabular-nums">₪{breakdown.recommended.toLocaleString()}</div>
      {breakdown.clampedBy && (
        <div className="text-[10px] text-amber-600">{breakdown.clampedBy === "floor" ? "רצפה" : "תקרה"}</div>
      )}
    </button>
  );
}

function DetailPanel({ date, b, onClose }: { date: string; b: PriceBreakdown; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(b.recommended));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <section className="mt-5 rounded-xl border border-zinc-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-zinc-500">{WEEKDAYS[dayOfWeek(date)]} · {fmtDay(date)}</div>
          <div className="mt-0.5 text-3xl font-bold tabular-nums">₪{b.recommended.toLocaleString()}</div>
        </div>
        <button onClick={onClose} className="text-sm text-zinc-400 hover:text-zinc-700">✕</button>
      </div>

      {b.holidayNames.length > 0 && (
        <div className="mt-2 inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          {b.holidayNames.join(" · ")}
        </div>
      )}

      <dl className="mt-4 space-y-1.5 text-sm">
        <Row k="בסיס" v={`₪${b.base.toLocaleString()}`} />
        {Object.entries(b.multipliers).map(([k, v]) => (
          <Row key={k} k={MULT_LABELS[k] ?? k} v={`×${v.toFixed(2)}`} dim={v === 1} />
        ))}
        <div className="my-2 border-t border-zinc-100" />
        <Row k="מחיר גולמי" v={`₪${Math.round(b.raw).toLocaleString()}`} dim />
        {b.clampedBy && (
          <Row k="נחסם ב" v={b.clampedBy === "floor" ? `רצפה (₪${b.floor})` : `תקרה (₪${b.ceiling})`} />
        )}
      </dl>

      <div className="mt-4 flex items-center gap-3 rounded-lg bg-zinc-50 p-3">
        <div className="flex-1 text-xs text-zinc-500">
          עדכנו את המחיר ל־<b className="text-zinc-800">₪{b.recommended.toLocaleString()}</b> ב־Airbnb / Booking.
        </div>
        <button
          onClick={copy}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
        >
          {copied ? "הועתק ✓" : "העתק מחיר"}
        </button>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
      {children}
    </label>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-0.5 text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
function Row({ k, v, dim }: { k: string; v: string; dim?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${dim ? "text-zinc-400" : "text-zinc-700"}`}>
      <span>{k}</span>
      <span className="font-medium tabular-nums">{v}</span>
    </div>
  );
}

function SyncBanner({ perSource, fetchedAt }: { perSource: FeedReport[]; fetchedAt: string }) {
  const connected = perSource.filter((s) => s.ok);
  const failed = perSource.filter((s) => !s.ok);
  const ageMin = Math.max(0, Math.round((Date.now() - new Date(fetchedAt).getTime()) / 60_000));
  const stale = ageMin >= STALE_AFTER_MINUTES;

  if (perSource.length === 0 || connected.length === 0) {
    return (
      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        <b>אין יומנים מחוברים.</b> המחירים מחושבים על לוח ריק — עונתיות, שבוע ישראלי ולוח עברי
        בלבד, בלי תפוסה אמיתית.
        {failed.length > 0 && (
          <span className="mt-1 block text-xs text-amber-700">
            {failed.map((s) => `${SOURCE_LABELS[s.source] ?? s.source}: ${s.error}`).join(" · ")}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`h-2 w-2 rounded-full ${stale ? "bg-amber-500" : "bg-emerald-500"}`} />
        <span className="text-zinc-700">
          סונכרן {ageMin < 1 ? "עכשיו" : `לפני ${ageMin} דק׳`}
        </span>
        <span className="text-zinc-300">·</span>
        {connected.map((s) => (
          <span key={s.source} className="text-zinc-600">
            {SOURCE_LABELS[s.source] ?? s.source}
            <span className="text-zinc-400">
              {" "}
              ({s.booked} תפוסים, {s.blocked} חסומים)
            </span>
          </span>
        ))}
      </div>

      {failed.length > 0 && (
        <div className="mt-2 text-xs text-amber-700">
          לא נקרא:{" "}
          {failed.map((s) => `${SOURCE_LABELS[s.source] ?? s.source} (${s.error})`).join(" · ")}
          {" — "}שאר היומנים עדיין בתוקף.
        </div>
      )}

      <div className="mt-1.5 text-xs text-zinc-400">
        יומני OTA מתרעננים כל כמה שעות, אז ייתכן פער קצר בין הזמנה חדשה לעדכון כאן.
      </div>
    </div>
  );
}
