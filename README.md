# smart-rate

A dynamic pricing engine and lightweight PMS for short-term rental apartments, built Hebrew-first for the Israeli market.

It reads an owner's real Airbnb and Booking.com calendars, works out a recommended price for every night for the next eight weeks, and — the part that matters — shows exactly how it got there, factor by factor, in shekels.

> **Status:** working software, early. The pricing engine, calendar ingestion, product UI and landing page are built and tested against a real apartment's live feeds. Persistence, auth and multi-tenancy are designed but not yet implemented. See [What isn't built](#what-isnt-built) — I'd rather be precise than impressive.

---

## Why this exists

The incumbents (PriceLabs, Beyond, Wheelhouse) are strong global products with two consistent gaps in this market:

- **They price an American week.** They assume a Friday–Saturday weekend. In Israel the leisure peak is **Thursday and Friday**, and Saturday night *softens* because Sunday is a workday. A tool that gets the week backwards prices the wrong nights every single week.
- **They price a Gregorian year.** Passover, Sukkot and Rosh Hashana move against the Gregorian calendar. Demand follows the Hebrew date, not a table someone remembers to update.

Neither has a Hebrew or RTL interface. That, plus radical transparency about *why* a price is what it is, is the wedge.

---

## The engineering worth looking at

### 1. The pricing engine is pure and deterministic

`computePrice` is a multiplicative model with no I/O, no clock, and no randomness:

```
price = clamp(
  base × season × dayOfWeek × leadTime × occupancy × event × lastMinute,
  floor   = variableCost + minMargin,
  ceiling = ownerCeiling
)
```

Everything under `lib/pricing/`, `lib/calendar/hebcal.ts`, `lib/calendar/ingest.ts`, `lib/dates.ts` and `lib/tax/` is I/O-free. The only impure function in the whole calendar pipeline is one `fetch`, isolated in `lib/calendar/load.ts`. That is what makes the engine cheap to test and trivial to reason about.

**Deliberately not machine learning.** With one apartment and no booking history there is nothing to train on, and an owner cannot audit a model that cannot explain itself. A transparent multiplicative model that a host can argue with beats an opaque one they have to trust.

### 2. "Why this price" — the differentiator, and the tricky bit

Telling an owner `×1.15` tells them nothing. `lib/pricing/waterfall.ts` decomposes the multiplicative chain into per-factor amounts in shekels:

```
base ₪550 → season +₪55 → day of week +₪151 → lead time +₪23
          → occupancy −₪19 → holiday +₪389 → last minute ₪0
                                                    = ₪1,168
```

The subtlety: rounding each factor independently produces a column of numbers that doesn't add up, which is worse than showing no breakdown at all. Deltas are derived from *rounded running totals*, so `base + Σ deltas` always equals the subtotal exactly. There's a test that asserts this across many dates.

### 3. Live calendar data changed a design decision

The feeds turned out to distinguish real reservations from blocks — Airbnb says `Reserved` vs `Airbnb (Not available)`.

That distinction is load-bearing. `forwardOccupancy` counts booked nights in the numerator but **excludes blocked nights from the denominator entirely**. Labelling a block as "booked" invents demand that doesn't exist and pushes prices up on a false signal. On the test apartment that would have meant treating a 47-night owner block as full occupancy.

Booking.com only ever emits `CLOSED - Not available`, which is genuinely ambiguous, so it's treated as a block — the reading that cannot fabricate demand.

### 4. Server/client boundary, forced by the data

`/app` had to be split into a server shell and a client view for two hard reasons:

- OTA iCal endpoints send **no CORS headers**, so a browser simply cannot fetch them.
- The feed URLs carry access tokens that must never reach the client.

Availability crosses the boundary as a plain object — a `Map` isn't serializable across the RSC boundary. The server also resolves "today" in `Asia/Jerusalem` so SSR and the client can't disagree about which night is which.

### 5. Failure is designed for, not hoped against

Feeds are fetched with per-source isolation: a dead or misconfigured feed is reported in the UI and contributes nothing, rather than throwing or taking the other feed down. `mergeFeeds` is total — it never throws, even on malformed ICS.

The UI states "last synced" and warns when data is stale, because OTA iCal refreshes only every few hours. **The interface must never imply real-time when the data isn't**; that gap is a genuine double-booking window, and pretending otherwise would be the most damaging thing this product could do.

### 6. RTL done properly

Not `dir="rtl"` and hope. Logical properties throughout, `tabular-nums` so price columns don't jitter, and bidi isolation on signed amounts — `+₪151` contains a bidi-neutral sign that will reorder inside an RTL paragraph without it. Holiday names render through hebcal's `he-x-NoNikud` locale rather than shipping an English string into a Hebrew UI.

---

## Architecture

| Layer | Choice | Reasoning |
|---|---|---|
| Framework | Next.js 16, React 19 | RSC gives a clean place for the server-side fetch |
| Styling | Tailwind 4 | Design tokens as CSS variables in `@theme`; dark mode on a data attribute |
| Hebrew calendar | `@hebcal/core` | Holidays derived from the Hebrew date, not a hardcoded table |
| Calendars | `ical.js` | RFC 5545 parsing |
| Tests | `node --test` + `tsx` | The logic is pure, so no test framework is needed |
| Persistence | Drizzle + Neon Postgres | Schema written; not yet wired (see below) |

```
lib/pricing/     engine, multipliers, config, occupancy, recommend, waterfall  (pure)
lib/calendar/    hebcal, ingest, feeds (pure) · load (the one fetch)
lib/tax/         Israeli VAT
config/units.ts  unit definitions, shaped onto the future `units` table
app/             / landing · /app rate calendar · /dev/engine playground
```

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

It runs with no configuration — with no calendars connected it prices off seasonality, the Hebrew calendar and the Israeli week, and says so in the UI.

To connect real calendars, copy `.env.example` to `.env.local` and add the iCal export URLs from your Airbnb and Booking.com host dashboards:

```
ICAL_AIRBNB_URL=...
ICAL_BOOKING_URL=...
```

```bash
npm test             # 39 tests
npm run build
```

---

## Tests

39 tests, covering the parts where being wrong costs money:

- **Engine** — holiday lift, the Israeli week shape (explicitly asserts Saturday softens relative to Friday), floor and ceiling clamps, cold-start neutrality, determinism.
- **Waterfall** — that `base + Σ deltas` equals the subtotal exactly, across many dates.
- **Feeds** — two sources merging, a failed source staying isolated, overlapping nights not double-counted, malformed ICS degrading safely, a reservation outranking a block.
- **Occupancy** — blocked nights excluded from the denominator.
- **Tax** — the 18% VAT split.

---

## What isn't built

Being straight about this, because a README that reads as finished when it isn't wastes everyone's time:

- **No persistence.** The Drizzle schema exists but no migration has been generated. Settings and recommendations are computed per request, not stored.
- **No auth, no multi-tenancy.** `properties` has no `ownerId` yet. That column is the one change that must land before any real data exists.
- **No competitor pricing.** Deliberate. There is no public API for competitor rates on any major OTA; the options are buying an estimate-quality feed or scraping into a permanent anti-bot arms race with real ToS exposure. v1 sidesteps it by pricing off the owner's own occupancy — which is enough to be useful on day one.
- **Prices are advisory.** Airbnb's partner API is invite-only and closed, so there is no way to push rates back automatically. The app recommends; the owner applies. Availability sync via iCal works today because that channel is actually open.
- **A known bug, in the open:** the Hebrew-calendar tier map classifies by hebcal's *religious* significance rather than *tourism demand*, so fast days like Tish'a B'Av currently price as demand peaks. It's a real miss, it's tracked, and it's the kind of thing that only surfaces when you look at real output instead of trusting the test suite.

---

## Roadmap

1. Neon Postgres + `properties.ownerId` — tenancy before data exists, not after
2. Persistence, nightly recompute, iCal sync job on a worker
3. Auth and onboarding
4. Competitor market data — once the buy-vs-scrape question is settled
5. Desktop (Tauri) and mobile (Capacitor) wrappers around the same web app
