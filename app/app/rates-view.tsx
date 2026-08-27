"use client";

import { useMemo, useRef, useState } from "react";
import { recommendRange, type UnitEconomics } from "@/lib/pricing/recommend";
import { forwardOccupancy, type AvailabilityStatus } from "@/lib/pricing/occupancy";
import type { PriceBreakdown } from "@/lib/pricing/engine";
import { explainPrice, type FactorKey } from "@/lib/pricing/waterfall";
import { toStatusMap, type FeedReport } from "@/lib/calendar/feeds";
import { applyVat } from "@/lib/tax/israel";
import { addDaysStr } from "@/lib/dates";

const WEEKS = 8;
const NIGHTS = WEEKS * 7;
const WEEKDAYS_SHORT = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];
const FACTOR_LABELS: Record<FactorKey, string> = {
  season: "עונה",
  dow: "יום בשבוע",
  leadTime: "מרחק הזמנה",
  occupancy: "תפוסה",
  event: "חג / אירוע",
  lastMinute: "רגע אחרון",
};
const SOURCE_LABELS: Record<string, string> = {
  airbnb: "Airbnb",
  booking: "Booking.com",
  vrbo: "Vrbo",
};
const STALE_AFTER_MINUTES = 180;

const nf = (n: number) => n.toLocaleString("en-US");
const dow = (s: string) => new Date(s + "T12:00:00").getDay();
const dayNum = (s: string) => new Date(s + "T12:00:00").getDate();
const monthOf = (s: string) => MONTHS[new Date(s + "T12:00:00").getMonth()];

/**
 * Price is encoded as intensity of a single hue per direction — not a spread of
 * colours. Booked and blocked nights are carried by shape and label instead, so
 * the grid still reads without colour vision.
 */
function tintFor(ratio: number): string | undefined {
  if (ratio >= 1.45) return "color-mix(in oklab, var(--up) 20%, var(--surface))";
  if (ratio >= 1.2) return "color-mix(in oklab, var(--up) 13%, var(--surface))";
  if (ratio >= 1.04) return "color-mix(in oklab, var(--up) 7%, var(--surface))";
  if (ratio <= 0.9) return "color-mix(in oklab, var(--down) 12%, var(--surface))";
  if (ratio <= 0.98) return "color-mix(in oklab, var(--down) 6%, var(--surface))";
  return undefined;
}

export interface RatesViewProps {
  economics: UnitEconomics;
  statusByDate: Record<string, AvailabilityStatus>;
  perSource: FeedReport[];
  fetchedAt: string;
  today: string;
}

export default function RatesView({
  economics,
  statusByDate,
  perSource,
  fetchedAt,
  today,
}: RatesViewProps) {
  const [base, setBase] = useState(economics.basePrice);
  const [variableCost, setVariableCost] = useState(economics.variableCost);
  const [minMargin, setMinMargin] = useState(economics.minMargin);
  const [ceiling, setCeiling] = useState(economics.ceiling ?? economics.basePrice * 4);
  const [selected, setSelected] = useState<string>(today);
  const [showSettings, setShowSettings] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const gridStart = addDaysStr(today, -dow(today));

  // On a phone the panel sits above a 56-row list, so a tap far down the list
  // would otherwise update something the user cannot see.
  const selectFromList = (date: string) => {
    setSelected(date);
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  const statusMap = useMemo(() => toStatusMap(statusByDate), [statusByDate]);

  const unit: UnitEconomics = useMemo(
    () => ({ basePrice: base, variableCost, minMargin, ceiling }),
    [base, variableCost, minMargin, ceiling],
  );

  const recs = useMemo(() => {
    const all = recommendRange({
      unit,
      statusByDate: statusMap,
      today,
      from: gridStart,
      nights: NIGHTS,
    });
    return new Map(all.map((r) => [r.date, r.breakdown]));
  }, [unit, statusMap, today, gridStart]);

  const stats = useMemo(() => {
    const forward = [...recs.entries()].filter(([d]) => d >= today).map(([, b]) => b);
    if (!forward.length) return null;
    const prices = forward.map((b) => b.recommended);
    return {
      avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      min: Math.min(...prices),
      max: Math.max(...prices),
      occupancy: forwardOccupancy(statusMap, today, NIGHTS),
    };
  }, [recs, today, statusMap]);

  const selBreakdown = recs.get(selected);
  const floor = variableCost + minMargin;

  return (
    <div className="flex flex-col gap-5">
      <SyncBanner perSource={perSource} fetchedAt={fetchedAt} />

      {stats && (
        <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat label="ממוצע ללילה" value={`₪${nf(stats.avg)}`} />
          <Stat label="הנמוך ביותר" value={`₪${nf(stats.min)}`} />
          <Stat label="הגבוה ביותר" value={`₪${nf(stats.max)}`} />
          <Stat label="תפוסה קדימה" value={`${Math.round(stats.occupancy * 100)}%`} />
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-lg font-bold tracking-tight">
              {monthOf(gridStart)} — {monthOf(addDaysStr(gridStart, NIGHTS - 1))}
            </h2>
            <span className="text-sm text-ink-2">{WEEKS} שבועות קדימה</span>
            <div className="flex-1" />
            <button
              onClick={() => setShowSettings((s) => !s)}
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-2 transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {showSettings ? "סגירת מחירי בסיס" : "מחירי בסיס"}
            </button>
          </div>

          {showSettings && (
            <div className="mb-4 rounded-xl border border-line bg-surface p-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <NumField label="מחיר בסיס" value={base} onChange={setBase} />
                <NumField label="עלות משתנה" value={variableCost} onChange={setVariableCost} />
                <NumField label="מרווח מינימלי" value={minMargin} onChange={setMinMargin} />
                <NumField label="תקרה" value={ceiling} onChange={setCeiling} />
              </div>
              <p className="mt-3 text-xs text-ink-3">
                רצפה = עלות משתנה + מרווח = ₪{nf(floor)}. המחיר לא יורד מתחתיה ולא עולה מעל התקרה.
              </p>
            </div>
          )}

          {/* Desktop: month grid. */}
          <div className="hidden sm:block">
            <div className="mb-1.5 grid grid-cols-7 gap-1.5">
              {WEEKDAYS_SHORT.map((d, i) => (
                <div
                  key={d}
                  className={`pb-1 text-center text-xs font-semibold ${
                    i === 4 || i === 5 ? "text-ink-2" : "text-ink-3"
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: NIGHTS }, (_, i) => {
                const date = addDaysStr(gridStart, i);
                return (
                  <DayCell
                    key={date}
                    date={date}
                    breakdown={recs.get(date)}
                    status={statusMap.get(date)}
                    past={date < today}
                    base={base}
                    selected={date === selected}
                    onSelect={() => setSelected(date)}
                  />
                );
              })}
            </div>
          </div>

          {/* Mobile: a vertical night list. A 7×8 grid does not survive a phone,
              and shrinking it just makes every night unreadable. */}
          <div className="sm:hidden">
            <ul className="overflow-hidden rounded-xl border border-line bg-surface">
              {Array.from({ length: NIGHTS }, (_, i) => addDaysStr(today, i)).map((date) => (
                <NightRow
                  key={date}
                  date={date}
                  breakdown={recs.get(date)}
                  status={statusMap.get(date)}
                  base={base}
                  selected={date === selected}
                  onSelect={() => selectFromList(date)}
                />
              ))}
            </ul>
          </div>
        </section>

        <aside ref={panelRef} className="order-first lg:order-last lg:sticky lg:top-20 lg:self-start">
          {selBreakdown ? (
            <WhyPanel date={selected} breakdown={selBreakdown} />
          ) : (
            <div className="rounded-xl border border-line bg-surface p-5 text-sm text-ink-3">
              בחרו לילה כדי לראות איך חושב המחיר.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ---------- calendar cells ---------- */

function DayCell({
  date, breakdown, status, past, base, selected, onSelect,
}: {
  date: string;
  breakdown?: PriceBreakdown;
  status?: AvailabilityStatus;
  past: boolean;
  base: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const n = dayNum(date);
  if (past || !breakdown) {
    return (
      <div className="min-h-[76px] rounded-lg bg-surface-2/60 p-2 text-xs text-ink-3/50">{n}</div>
    );
  }

  const taken = status === "booked" || status === "blocked";
  const ring = selected
    ? "outline outline-2 outline-accent -outline-offset-1"
    : "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent";

  if (taken) {
    return (
      <button
        onClick={onSelect}
        className={`min-h-[76px] rounded-lg border border-dashed border-line bg-surface-2 p-2 text-start transition hover:border-ink-3 ${ring}`}
      >
        <div className="flex items-start justify-between gap-1">
          <span className="text-[11px] font-medium text-ink-3">{n}</span>
          <span className="text-[9px] font-semibold text-ink-3">
            {status === "booked" ? "תפוס" : "חסום"}
          </span>
        </div>
        <div className="tnum mt-1.5 text-sm font-medium text-ink-3">
          ₪{nf(breakdown.recommended)}
        </div>
      </button>
    );
  }

  const holiday = breakdown.holidayNames[0];
  return (
    <button
      onClick={onSelect}
      style={{ background: tintFor(breakdown.recommended / base) }}
      className={`min-h-[76px] rounded-lg border border-line bg-surface p-2 text-start transition hover:border-ink-3 ${ring}`}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-[11px] font-medium text-ink-3">{n}</span>
        {breakdown.clampedBy && (
          <span className="text-[9px] font-semibold text-down">
            {breakdown.clampedBy === "floor" ? "רצפה" : "תקרה"}
          </span>
        )}
      </div>
      {holiday && (
        <div className="mt-1 flex items-center gap-1">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-holiday" />
          <span className="truncate text-[10px] font-medium text-holiday">{holiday}</span>
        </div>
      )}
      <div className="tnum mt-1 text-[15px] font-semibold">₪{nf(breakdown.recommended)}</div>
    </button>
  );
}

function NightRow({
  date, breakdown, status, base, selected, onSelect,
}: {
  date: string;
  breakdown?: PriceBreakdown;
  status?: AvailabilityStatus;
  base: number;
  selected: boolean;
  onSelect: () => void;
}) {
  if (!breakdown) return null;
  const taken = status === "booked" || status === "blocked";
  const pct = Math.round((breakdown.recommended / base - 1) * 100);
  const up = pct > 3;
  const down = pct < -3;
  const holiday = breakdown.holidayNames[0];

  return (
    <li>
      <button
        onClick={onSelect}
        className={`flex w-full items-center gap-3 border-b border-line px-3 py-2.5 text-start transition ${
          taken ? "bg-surface-2" : ""
        } ${selected ? "bg-accent/10" : ""}`}
      >
        <span className="w-9 shrink-0 text-center">
          <span className={`tnum block text-lg font-semibold ${taken ? "text-ink-3" : ""}`}>
            {dayNum(date)}
          </span>
          <span className="block text-[10px] font-medium text-ink-3">
            {WEEKDAYS_SHORT[dow(date)]}
          </span>
        </span>
        <span
          className="h-8 w-[3px] shrink-0 rounded-full"
          style={{
            background: taken
              ? "var(--line)"
              : up
                ? "var(--up)"
                : down
                  ? "var(--down)"
                  : "var(--line)",
          }}
        />
        <span className="min-w-0 flex-1">
          {holiday && (
            <span className="mb-0.5 flex items-center gap-1">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-holiday" />
              <span className="truncate text-[11px] font-medium text-holiday">{holiday}</span>
            </span>
          )}
          <span className="block text-xs text-ink-2">
            {status === "booked" ? "תפוס" : status === "blocked" ? "חסום" : "פנוי"}
          </span>
        </span>
        <span className="shrink-0 text-end">
          <span className={`tnum block text-lg font-semibold ${taken ? "text-ink-3" : ""}`}>
            ₪{nf(breakdown.recommended)}
          </span>
          {!taken && (up || down) && (
            <span
              className={`num-ltr block text-[11px] font-medium ${up ? "text-up" : "text-down"}`}
            >
              {up ? `+${pct}%` : `${pct}%`}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

/* ---------- why this price ---------- */

function WhyPanel({ date, breakdown }: { date: string; breakdown: PriceBreakdown }) {
  const [copied, setCopied] = useState(false);
  const w = explainPrice(breakdown);
  const vat = applyVat(breakdown.recommended, "israeli");
  const maxAbs = Math.max(1, ...w.steps.map((s) => Math.abs(s.delta)));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(breakdown.recommended));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="text-xs font-semibold tracking-wide text-ink-3">למה המחיר הזה</div>
      <div className="mt-2 text-[15px] font-semibold">
        {WEEKDAYS[dow(date)]}, {dayNum(date)} ב{monthOf(date)}
      </div>
      {breakdown.holidayNames.length > 0 && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-holiday" />
          <span className="text-xs font-medium text-holiday">
            {breakdown.holidayNames.join(" · ")}
          </span>
        </div>
      )}

      <div className="mt-4 flex items-baseline gap-2">
        <span className="tnum text-4xl font-bold tracking-tight">
          ₪{nf(breakdown.recommended)}
        </span>
        <span className="text-sm text-ink-2">ללילה</span>
      </div>
      <div className="tnum mt-1 text-xs text-ink-2">
        ₪{nf(Math.round(vat.netOfVat))} נטו אחרי מע״מ 18%
      </div>

      <div className="my-4 h-px bg-line" />

      <dl className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between text-sm">
          <dt className="text-ink-2">מחיר בסיס</dt>
          <dd className="tnum font-semibold">₪{nf(w.base)}</dd>
        </div>
        {w.steps.map((s) => {
          const neutral = s.delta === 0;
          const up = s.delta > 0;
          return (
            <div key={s.key} className={neutral ? "opacity-45" : ""}>
              <div className="flex items-center justify-between text-sm">
                <dt className="text-ink-2">{FACTOR_LABELS[s.key]}</dt>
                <dd
                  className={`num-ltr tnum font-semibold ${
                    neutral ? "text-ink-3" : up ? "text-up" : "text-down"
                  }`}
                >
                  {neutral ? "—" : `${up ? "+" : "−"}₪${nf(Math.abs(s.delta))}`}
                </dd>
              </div>
              <div
                className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-surface-2"
                style={{ justifyContent: up ? "flex-start" : "flex-end" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round((Math.abs(s.delta) / maxAbs) * 100)}%`,
                    background: up ? "var(--up)" : "var(--down)",
                    opacity: neutral ? 0 : 1,
                  }}
                />
              </div>
            </div>
          );
        })}
        {w.clampedBy && (
          <div className="flex items-center justify-between text-sm">
            <dt className="text-down">{w.clampedBy === "floor" ? "הועלה לרצפה" : "הורד לתקרה"}</dt>
            <dd className="num-ltr tnum font-semibold text-down">
              {w.clampDelta > 0 ? "+" : "−"}₪{nf(Math.abs(w.clampDelta))}
            </dd>
          </div>
        )}
      </dl>

      <div className="my-3 h-px bg-line" />
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">מחיר מומלץ</span>
        <span className="tnum text-base font-bold">₪{nf(breakdown.recommended)}</span>
      </div>
      <p className="tnum mt-1.5 text-[11px] text-ink-3">
        רצפה ₪{nf(breakdown.floor)} · תקרה ₪{nf(breakdown.ceiling)}
      </p>

      <button
        onClick={copy}
        className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-accent-ink transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {copied ? "הועתק ✓" : "העתקת המחיר"}
      </button>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
        עדכון המחיר ב-Airbnb / Booking נעשה ידנית — אין להן API פתוח לדחיפת מחירים.
      </p>
    </div>
  );
}

/* ---------- chrome ---------- */

function SyncBanner({ perSource, fetchedAt }: { perSource: FeedReport[]; fetchedAt: string }) {
  const connected = perSource.filter((s) => s.ok);
  const failed = perSource.filter((s) => !s.ok);
  const ageMin = Math.max(0, Math.round((Date.now() - new Date(fetchedAt).getTime()) / 60_000));
  const stale = ageMin >= STALE_AFTER_MINUTES;

  if (connected.length === 0) {
    return (
      <div className="rounded-xl border border-down/40 bg-down/10 p-3.5 text-sm">
        <b className="font-semibold">אין יומנים מחוברים.</b>{" "}
        <span className="text-ink-2">
          המחירים מחושבים על לוח ריק — עונתיות, שבוע ישראלי ולוח עברי בלבד, בלי תפוסה אמיתית.
        </span>
        {failed.length > 0 && (
          <div className="mt-1 text-xs text-ink-3">
            {failed.map((s) => `${SOURCE_LABELS[s.source] ?? s.source}: ${s.error}`).join(" · ")}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface px-3.5 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`h-2 w-2 rounded-full ${stale ? "bg-down" : "bg-up"}`} />
        <span className="text-ink-2">סונכרן {ageMin < 1 ? "עכשיו" : `לפני ${ageMin} דק׳`}</span>
        <span className="text-ink-3">·</span>
        {connected.map((s) => (
          <span key={s.source} className="text-ink-2">
            {SOURCE_LABELS[s.source] ?? s.source}{" "}
            <span className="text-ink-3">
              ({s.booked} תפוסים, {s.blocked} חסומים)
            </span>
          </span>
        ))}
      </div>
      {failed.length > 0 && (
        <div className="mt-1.5 text-xs text-down">
          לא נקרא:{" "}
          {failed.map((s) => `${SOURCE_LABELS[s.source] ?? s.source} (${s.error})`).join(" · ")} —
          שאר היומנים עדיין בתוקף.
        </div>
      )}
      <div className="mt-1 text-[11px] text-ink-3">
        יומני OTA מתרעננים כל כמה שעות, אז ייתכן פער קצר בין הזמנה חדשה לעדכון כאן.
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3.5 py-3">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="tnum mt-0.5 text-xl font-bold">{value}</div>
    </div>
  );
}

function NumField({
  label, value, onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-2">{label} (₪)</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="tnum w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-ink-3 focus:outline-none"
      />
    </label>
  );
}
