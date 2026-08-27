"use client";

import { useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import type { FactorKey } from "@/lib/pricing/waterfall";

type Locale = "he" | "en";

const BAR_MAX = 150;

export interface LandingExample {
  date: string;
  holiday: string;
  recommended: number;
  base: number;
  steps: Array<{ key: FactorKey; delta: number }>;
}

const COPY = {
  he: {
    dir: "rtl" as const,
    nav: { how: "איך זה עובד", price: "מחיר", signIn: "כניסה" },
    badge: "בנוי לשוק הישראלי",
    h1: "המחיר הנכון לכל לילה — לפי הלוח העברי, לא לפי לוח אמריקאי.",
    sub: "smart-rate מחשב מחיר מומלץ לכל לילה בדירה שלך: עונה, חגים, סוף השבוע הישראלי והתפוסה שלך בפועל. ואז מראה בדיוק למה — שקל אחר שקל.",
    cta: "חיבור היומן שלי",
    ctaNote: "קריאה בלבד מ-Airbnb ו-Booking.com",
    weekTitle: "שבוע טיפוסי · דירת 3 חדרים",
    weekNote:
      "חמישי ושישי הם השיא. מוצ״ש כבר יורד — כי ביום ראשון חוזרים לעבודה. כלי גלובלי מתמחר כאן סופ״ש של שישי־שבת, ומפספס.",
    weekdays: ["א", "ב", "ג", "ד", "ה", "ו", "ש"],
    neutralLabel: "יום ניטרלי",
    feats: [
      {
        t: "הלוח העברי, מובנה",
        b: "פסח, סוכות, ראש השנה וחול המועד מזוהים לפי התאריך העברי — לא לפי טבלה שצריך לעדכן כל שנה.",
      },
      {
        t: "סוף השבוע הישראלי",
        b: "חמישי ושישי הם שיא הביקוש, ומוצאי שבת כבר נחלש. כלים גלובליים מניחים שישי־שבת ומתמחרים לא נכון.",
      },
      {
        t: "שקוף, וניתן לעקיפה",
        b: "כל מחיר מגיע עם פירוק מלא בשקלים, ורצפה שלא יורדים מתחתיה. המילה האחרונה תמיד שלך.",
      },
    ],
    whyTitle: "כל מחיר מגיע עם הסבר.",
    whyBody:
      "רוב כלי התמחור נותנים מספר ואומרים ״סמוך עלינו״. כאן רואים את הפירוק המלא: כמה שקלים הוסיפה העונה, כמה הוסיף החג, כמה הורידה התפוסה. אם לא מסכימים — משנים ידנית.",
    exampleNote: "דוגמה אמיתית מהמנוע, לא מספרים מומצאים.",
    baseLabel: "מחיר בסיס",
    recommendedLabel: "מחיר מומלץ",
    factors: {
      season: "עונה",
      dow: "יום בשבוע",
      leadTime: "מרחק הזמנה",
      occupancy: "תפוסה",
      event: "חג / אירוע",
      lastMinute: "רגע אחרון",
    } as Record<FactorKey, string>,
    howTitle: "שלושה שלבים, פעם אחת.",
    how: [
      { t: "מחברים יומן", b: "מדביקים את קישור ה-iCal מ-Airbnb או Booking. קריאה בלבד — לא נוגעים בהזמנות שלך." },
      { t: "קובעים בסיס", b: "מחיר בסיס, עלות משתנה ורצפת רווח — כדי שהמנוע לא ירד מתחת לכדאיות." },
      { t: "רואים מחירים", b: "לוח של שמונה שבועות עם מחיר מומלץ לכל לילה, והסבר מלא לכל אחד." },
    ],
    priceTag: "[ למלא לפני השקה ]",
    priceTitle: "[ המחיר שלך ] לחודש, לדירה",
    priceBody:
      "עוד לא נקבע: מחיר קבוע או אחוז מההכנסה, תקופת ניסיון, והנחה לכמה דירות. אין כאן מספרים אמיתיים עדיין — בכוונה.",
    priceCta: "התחלה",
    footer: { privacy: "פרטיות", terms: "תנאים", contact: "צור קשר" },
    langLabel: "EN",
  },
  en: {
    dir: "ltr" as const,
    nav: { how: "How it works", price: "Pricing", signIn: "Sign in" },
    badge: "Built for the Israeli market",
    h1: "The right price for every night — on the Hebrew calendar, not an American one.",
    sub: "smart-rate works out a recommended price for each night in your apartment: season, holidays, the Israeli weekend, and your actual occupancy. Then it shows exactly why — shekel by shekel.",
    cta: "Connect my calendar",
    ctaNote: "Read-only, from Airbnb and Booking.com",
    weekTitle: "A typical week · 3-room apartment",
    weekNote:
      "Thursday and Friday are the peak. Saturday night already softens — Sunday is a workday here. A global tool prices a Fri–Sat weekend and gets this wrong.",
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    neutralLabel: "Neutral day",
    feats: [
      {
        t: "The Hebrew calendar, built in",
        b: "Passover, Sukkot, Rosh Hashana and Chol HaMoed are derived from the Hebrew date — not a table someone has to update every year.",
      },
      {
        t: "The Israeli week",
        b: "Thursday and Friday carry the demand, and Saturday night falls away. Tools that assume a Fri–Sat weekend price the wrong nights.",
      },
      {
        t: "Transparent, and overridable",
        b: "Every price comes with a full breakdown in shekels and a floor it will not go under. The last word is always yours.",
      },
    ],
    whyTitle: "Every price comes with its reasoning.",
    whyBody:
      "Most pricing tools hand you a number and ask you to trust it. Here you see the whole decomposition: what the season added, what the holiday added, what occupancy took away. Disagree, and you override it.",
    exampleNote: "A real night from the engine — not illustrative numbers.",
    baseLabel: "Base price",
    recommendedLabel: "Recommended",
    factors: {
      season: "Season",
      dow: "Day of week",
      leadTime: "Lead time",
      occupancy: "Occupancy",
      event: "Holiday / event",
      lastMinute: "Last minute",
    } as Record<FactorKey, string>,
    howTitle: "Three steps, once.",
    how: [
      { t: "Connect a calendar", b: "Paste the iCal link from Airbnb or Booking. Read-only — your reservations are never touched." },
      { t: "Set your floor", b: "Base price, variable cost and minimum margin, so the engine never prices below what is worth your while." },
      { t: "See your rates", b: "An eight-week calendar with a recommended price per night, and the reasoning behind each one." },
    ],
    priceTag: "[ TO SET BEFORE LAUNCH ]",
    priceTitle: "[ YOUR PRICE ] per month, per apartment",
    priceBody:
      "Not decided yet: flat fee or a share of revenue, trial length, and multi-unit discounts. There are deliberately no real numbers here yet.",
    priceCta: "Get started",
    footer: { privacy: "Privacy", terms: "Terms", contact: "Contact" },
    langLabel: "עב",
  },
};

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
        <path d="M3 17l5-6 4 3 5-8" />
        <circle cx="20" cy="5" r="1.6" fill="currentColor" stroke="none" />
      </svg>
      <span className="text-base font-bold tracking-tight">smart-rate</span>
    </span>
  );
}

export default function Landing({
  week,
  neutral,
  peakDows,
  example,
}: {
  week: number[];
  neutral: number;
  peakDows: number[];
  example: LandingExample | null;
}) {
  const [locale, setLocale] = useState<Locale>("he");
  const t = COPY[locale];
  const nf = (n: number) => n.toLocaleString("en-US");
  const maxWeek = Math.max(...week);
  const maxDelta = example ? Math.max(1, ...example.steps.map((s) => Math.abs(s.delta))) : 1;

  return (
    <div dir={t.dir} className="flex min-h-full flex-col">
      {/* nav */}
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-4 px-5 sm:px-8">
          <Logo />
          <div className="flex-1" />
          <nav className="hidden items-center gap-6 text-sm text-ink-2 sm:flex">
            <a href="#how" className="transition hover:text-ink">{t.nav.how}</a>
            <a href="#price" className="transition hover:text-ink">{t.nav.price}</a>
          </nav>
          <button
            onClick={() => setLocale(locale === "he" ? "en" : "he")}
            className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-2 transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {t.langLabel}
          </button>
          <ThemeToggle />
          <Link href="/app" className="text-sm font-semibold transition hover:text-accent">
            {t.nav.signIn}
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* hero */}
        <section className="mx-auto grid w-full max-w-5xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:py-20">
          <div>
            <span className="inline-flex rounded-full bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent">
              {t.badge}
            </span>
            <h1 className="mt-5 font-[family-name:var(--font-frank)] text-[38px] font-bold leading-[1.18] tracking-tight text-balance sm:text-5xl">
              {t.h1}
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-2 text-pretty">{t.sub}</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/app"
                className="inline-flex h-12 items-center rounded-lg bg-accent px-7 text-[15px] font-semibold text-accent-ink transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {t.cta}
              </Link>
              <span className="text-sm text-ink-2">{t.ctaNote}</span>
            </div>
          </div>

          {/* the real day-of-week curve */}
          <div className="rounded-2xl border border-line bg-surface p-6">
            <div className="text-xs font-semibold tracking-wide text-ink-3">{t.weekTitle}</div>
            <div className="mt-6">
              <div className="relative" style={{ height: BAR_MAX }}>
                {/* Bars stay zero-based; this line marks the neutral day, so the
                    Thu/Fri lift is visible without a truncated axis. */}
                <div
                  className="absolute inset-x-0 z-10 border-t border-dashed border-ink-3/50"
                  style={{ bottom: Math.round((neutral / maxWeek) * BAR_MAX) }}
                >
                  <span className="absolute -top-[7px] end-0 bg-surface ps-1.5 text-[10px] font-medium text-ink-3">
                    {t.neutralLabel}
                  </span>
                </div>
                <div className="absolute inset-0 flex items-end gap-2">
                  {week.map((price, i) => {
                    const peak = peakDows.includes(i);
                    return (
                      <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                        {/* Seven labels do not fit a phone; off-peak ones stay
                            in the layout but hide, so the bars never shift. */}
                        <span
                          className={`tnum num-ltr text-[10px] font-semibold sm:text-xs ${
                            peak ? "text-up" : "text-ink-3 max-[420px]:invisible"
                          }`}
                        >
                          ₪{nf(price)}
                        </span>
                        <div
                          className="w-full rounded-t-md"
                          style={{
                            height: Math.round((price / maxWeek) * BAR_MAX),
                            background: peak
                              ? "var(--up)"
                              : "color-mix(in oklab, var(--ink-3) 30%, transparent)",
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                {t.weekdays.map((d, i) => (
                  <span
                    key={i}
                    className={`flex-1 text-center text-xs font-medium ${
                      peakDows.includes(i) ? "text-ink-2" : "text-ink-3"
                    }`}
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
            <div className="my-4 h-px bg-line" />
            <p className="text-[13px] leading-relaxed text-ink-2">{t.weekNote}</p>
          </div>
        </section>

        {/* differentiators */}
        <section className="mx-auto grid w-full max-w-5xl gap-7 px-5 pb-20 sm:px-8 md:grid-cols-3">
          {t.feats.map((f) => (
            <div key={f.t} className="border-t-2 border-accent pt-5">
              <h3 className="text-[17px] font-bold tracking-tight">{f.t}</h3>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-ink-2 text-pretty">{f.b}</p>
            </div>
          ))}
        </section>

        {/* transparency, with a real breakdown */}
        <section className="border-y border-line bg-surface-2">
          <div className="mx-auto grid w-full max-w-5xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[minmax(0,1fr)_400px]">
            <div>
              <h2 className="font-[family-name:var(--font-frank)] text-4xl font-bold leading-tight tracking-tight">
                {t.whyTitle}
              </h2>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-2 text-pretty">{t.whyBody}</p>
              <p className="mt-4 text-[13px] text-ink-3">{t.exampleNote}</p>
            </div>

            {example && (
              <div className="rounded-2xl border border-line bg-surface p-6">
                <div className="text-sm font-semibold">
                  {new Date(example.date + "T12:00:00").toLocaleDateString(
                    locale === "he" ? "he-IL" : "en-GB",
                    { weekday: "long", day: "numeric", month: "long" },
                  )}
                </div>
                {example.holiday && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-holiday" />
                    <span className="text-xs font-medium text-holiday">{example.holiday}</span>
                  </div>
                )}
                <dl className="mt-5 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <dt className="text-ink-2">{t.baseLabel}</dt>
                    <dd className="tnum font-semibold">₪{nf(example.base)}</dd>
                  </div>
                  {example.steps.map((s) => {
                    const neutral = s.delta === 0;
                    const up = s.delta > 0;
                    return (
                      <div key={s.key} className={neutral ? "opacity-45" : ""}>
                        <div className="flex items-center justify-between text-sm">
                          <dt className="text-ink-2">{t.factors[s.key]}</dt>
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
                              width: `${Math.round((Math.abs(s.delta) / maxDelta) * 100)}%`,
                              background: up ? "var(--up)" : "var(--down)",
                              opacity: neutral ? 0 : 1,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </dl>
                <div className="my-4 h-px bg-line" />
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-bold">{t.recommendedLabel}</span>
                  <span className="tnum text-xl font-bold tracking-tight">
                    ₪{nf(example.recommended)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* how it works */}
        <section id="how" className="mx-auto w-full max-w-5xl px-5 py-20 sm:px-8">
          <h2 className="font-[family-name:var(--font-frank)] text-3xl font-bold tracking-tight">
            {t.howTitle}
          </h2>
          <div className="mt-9 grid gap-8 md:grid-cols-3">
            {t.how.map((h, i) => (
              <div key={h.t} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-sm font-bold text-accent">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-[15.5px] font-semibold">{h.t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-2 text-pretty">{h.b}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* pricing — deliberately unfilled */}
        <section id="price" className="mx-auto w-full max-w-5xl px-5 pb-20 sm:px-8">
          <div className="flex flex-col items-start gap-7 rounded-2xl border-2 border-dashed border-line p-9 sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="text-xs font-bold tracking-wider text-down">{t.priceTag}</div>
              <div className="mt-2.5 font-[family-name:var(--font-frank)] text-[27px] font-bold tracking-tight">
                {t.priceTitle}
              </div>
              <p className="mt-2.5 max-w-xl text-[14.5px] leading-relaxed text-ink-2 text-pretty">
                {t.priceBody}
              </p>
            </div>
            <Link
              href="/app"
              className="inline-flex h-12 shrink-0 items-center rounded-lg bg-accent px-7 text-[15px] font-semibold text-accent-ink transition hover:opacity-90"
            >
              {t.priceCta}
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-8 text-[13px] text-ink-3 sm:px-8">
          <span>smart-rate</span>
          <div className="flex-1" />
          <span>{t.footer.privacy}</span>
          <span>{t.footer.terms}</span>
          <span>{t.footer.contact}</span>
        </div>
      </footer>
    </div>
  );
}
