"use client";

import { useMemo, useState } from "react";
import { computePrice } from "@/lib/pricing/engine";
import { applyVat, type GuestType } from "@/lib/tax/israel";

const inputCls =
  "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none";

const MULT_LABELS: Record<string, string> = {
  season: "עונה",
  dow: "יום בשבוע",
  leadTime: "מרחק הזמנה",
  occupancy: "תפוסה",
  event: "אירוע / חג",
  lastMinute: "רגע אחרון",
};

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function Home() {
  const [basePrice, setBasePrice] = useState(500);
  const [dateStr, setDateStr] = useState("2026-07-03"); // a Friday
  const [occupancy, setOccupancy] = useState(0.5);
  const [isOpen, setIsOpen] = useState(true);
  const [floor, setFloor] = useState(300);
  const [ceiling, setCeiling] = useState(2000);
  const [guest, setGuest] = useState<GuestType>("israeli");

  const { breakdown, vat, leadTimeDays } = useMemo(() => {
    const date = parseLocalDate(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const leadTimeDays = Math.max(
      0,
      Math.round((date.getTime() - today.getTime()) / 86_400_000),
    );
    const breakdown = computePrice({
      basePrice,
      date,
      leadTimeDays,
      forwardOccupancy: occupancy,
      isOpen,
      floor,
      ceiling,
    });
    const vat = applyVat(breakdown.recommended, guest);
    return { breakdown, vat, leadTimeDays };
  }, [basePrice, dateStr, occupancy, isOpen, floor, ceiling, guest]);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 text-zinc-900">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">smart-rate · תצוגת מנוע התמחור</h1>
        <p className="mt-1 text-sm text-zinc-500">
          v1 — מתמחר לפי עונתיות, לוח עברי, אירועים ותפוסה עצמית. ללא נתוני מתחרים.
        </p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* controls */}
        <section className="space-y-4 rounded-xl border border-zinc-200 p-5">
          <Field label="מחיר בסיס (₪)">
            <input
              type="number"
              value={basePrice}
              onChange={(e) => setBasePrice(+e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="תאריך לילה">
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label={`תפוסה צפויה: ${Math.round(occupancy * 100)}%`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={occupancy}
              onChange={(e) => setOccupancy(+e.target.value)}
              className="w-full"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="רצפה (₪)">
              <input
                type="number"
                value={floor}
                onChange={(e) => setFloor(+e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="תקרה (₪)">
              <input
                type="number"
                value={ceiling}
                onChange={(e) => setCeiling(+e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="סוג אורח (מע״מ)">
            <select
              value={guest}
              onChange={(e) => setGuest(e.target.value as GuestType)}
              className={inputCls}
            >
              <option value="israeli">ישראלי (18% מע״מ)</option>
              <option value="foreign_tourist">תייר זר (0% — לאימות)</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={isOpen}
              onChange={(e) => setIsOpen(e.target.checked)}
            />
            הלילה עדיין פנוי (מאפשר הנחת רגע אחרון)
          </label>
        </section>

        {/* result */}
        <section className="rounded-xl border border-zinc-200 p-5">
          <div className="text-sm text-zinc-500">מחיר מומלץ ללילה</div>
          <div className="mt-1 text-4xl font-bold tabular-nums">
            ₪{breakdown.recommended.toLocaleString()}
          </div>
          {breakdown.clampedBy && (
            <div className="mt-1 text-xs font-medium text-amber-600">
              {breakdown.clampedBy === "floor" ? "נחסם ברצפה" : "נחסם בתקרה"}
            </div>
          )}
          {breakdown.holidayNames.length > 0 && (
            <div className="mt-2 inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
              {breakdown.holidayNames.join(" · ")}
            </div>
          )}

          <dl className="mt-4 space-y-1.5 text-sm">
            <Row k="בסיס" v={`₪${breakdown.base.toLocaleString()}`} />
            {Object.entries(breakdown.multipliers).map(([k, v]) => (
              <Row
                key={k}
                k={MULT_LABELS[k] ?? k}
                v={`×${v.toFixed(2)}`}
                dim={v === 1}
              />
            ))}
            <div className="my-2 border-t border-zinc-100" />
            <Row k="מחיר גולמי" v={`₪${Math.round(breakdown.raw).toLocaleString()}`} />
            <Row
              k={`נטו אחרי מע״מ (${Math.round(vat.rateApplied * 100)}%)`}
              v={`₪${Math.round(vat.netOfVat).toLocaleString()}`}
            />
            <Row k="מרחק הזמנה" v={`${leadTimeDays} ימים`} dim />
          </dl>
          {vat.verify && (
            <p className="mt-3 text-xs text-amber-600">
              * פטור המע״מ לתייר זר ב-STR פרטי טעון אימות.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-700">{label}</span>
      {children}
    </label>
  );
}

function Row({ k, v, dim }: { k: string; v: string; dim?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between ${
        dim ? "text-zinc-400" : "text-zinc-700"
      }`}
    >
      <span>{k}</span>
      <span className="font-medium tabular-nums">{v}</span>
    </div>
  );
}
