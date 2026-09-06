# smart-rate

smart-rate computes a recommended nightly price for a short-term rental in Israel and shows exactly how it got there. It reads the unit's availability from its OTA iCal feeds, combines seasonality, the Israeli day-of-week shape, the Hebrew calendar and the unit's own forward occupancy into a single multiplicative recommendation, and breaks that recommendation down into shekel-by-shekel contributions per factor. It uses no competitor data and no machine learning: every number on screen is reproducible from the inputs and a config object.

The product surface is Hebrew-first and right-to-left. This repository is a work in progress by a single author; see [Status and limitations](#status-and-limitations) for an honest account of what is and is not built.

---

## The pricing model

The engine is deliberately simple: one base price, six independent multipliers, a round, and a clamp into an owner-supplied band. Nothing is additive, no factor is capped individually, and no factor depends on any other.

```
floor       = variableCost + minMargin
ceiling     = owner-set ceiling, or basePrice × 4 when the owner has not set one

raw         = basePrice
              × season(date)
              × dow(date)
              × leadTime(leadTimeDays)
              × occupancy(forwardOccupancy)
              × event(date, manualEventMultiplier)
              × lastMinute(leadTimeDays, isOpen)

recommended = round(raw), then clamped into [floor, ceiling]
```

Entry point, in `lib/pricing/engine.ts`:

```ts
export function computePrice(input: PriceInput): PriceBreakdown;

interface PriceInput {
  basePrice: number;
  date: Date;                     // the night being priced
  leadTimeDays: number;           // days until check-in
  forwardOccupancy: number;       // forward occupancy of a comparable window, 0..1
  isOpen: boolean;                // gates the last-minute discount
  manualEventMultiplier?: number; // from the manual events table, >= 1
  floor: number;                  // variable cost + minimum margin
  ceiling: number;                // owner-set ceiling
  config?: Partial<PricingConfig>;
}

interface PriceBreakdown {
  base: number;
  multipliers: { season; dow; leadTime; occupancy; event; lastMinute };
  raw: number;                    // the unrounded product
  recommended: number;
  floor: number;
  ceiling: number;
  clampedBy: "floor" | "ceiling" | null;
  holidayNames: string[];
}
```

### The six factors

All defaults below live in `DEFAULT_CONFIG_IL` (`lib/pricing/config.ts`) and every field can be overridden per call through `PriceInput.config`.

**1. Season, by calendar month.** A direct lookup of `seasonByMonth[date.getMonth()]`.

| Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0.85 | 0.85 | 0.95 | 1.15 | 1.00 | 1.05 | 1.20 | 1.25 | 1.10 | 1.05 | 0.90 | 0.95 |

**2. Day of week.** A direct lookup of `dow[date.getDay()]`, indexed 0 = Sunday.

| Sun | Mon | Tue | Wed | Thu | Fri | Sat |
| --- | --- | --- | --- | --- | --- | --- |
| 0.95 | 0.92 | 0.92 | 0.95 | 1.15 | 1.25 | 1.00 |

This profile is the product's main opinion. See [Israel-first by design](#israel-first-by-design).

**3. Lead time.** Band lookup on days until check-in.

| Days out | Multiplier |
| --- | --- |
| up to 7 | 1.00 (near-term is handled by the last-minute factor instead) |
| 8 to 30 | 1.03 |
| 31 to 90 | 1.00 |
| 91 and beyond | 0.97 (a small early-bird discount) |

**4. Forward occupancy.** The share of *sellable* nights already booked in a forward window (30 nights by default), computed by `forwardOccupancy` in `lib/pricing/occupancy.ts`. Owner-blocked nights are removed from both the numerator and the denominator, so blocking a night for personal use neither invents demand nor dilutes it. Unknown dates are treated as open.

The band multiplier is then blended toward neutral by `occupancyWeight` (0.3 by default):

```
occupancy = 1 + (bandMultiplier - 1) × occupancyWeight
```

| Forward occupancy | Band | Effective at weight 0.3 |
| --- | --- | --- |
| up to 0.30 | 0.92 | 0.976 |
| up to 0.60 | 1.00 | 1.000 |
| up to 0.80 | 1.08 | 1.024 |
| up to 1.00 | 1.18 | 1.054 |

The weight exists for cold start: a brand new unit with an empty calendar reports occupancy 0, and the blend keeps that from crushing the price. This is the only multiplier that is post-processed rather than used raw.

**5. Events and holidays.** `getHolidayInfo(date)` classifies the night into a tier from the Hebrew calendar, and the tier multiplier is combined with any manual event covering that date by taking the **maximum**, not the product. Overlapping events therefore cannot compound into a runaway price.

| Tier | Multiplier |
| --- | --- |
| `major` | 1.50 |
| `cholHamoed` | 1.40 |
| `modern` | 1.25 |
| `minor` | 1.12 |
| `none` | 1.00 |

Manual events (`recommendRange` in `lib/pricing/recommend.ts`) cover an inclusive date range with a multiplier; where several overlap, the largest wins.

**6. Last minute.** Applies only to nights that are still open. A booked or blocked night gets exactly 1.0, bypassing the bands entirely.

| Days out | Multiplier (open nights only) |
| --- | --- |
| up to 3 | 0.85 |
| 4 to 7 | 0.93 |
| 8 and beyond | 1.00 |

Because lead time and last minute both read `leadTimeDays`, their combined near-term effect on an open night is 0.85 inside three days, 0.93 from four to seven days, and 1.03 from eight to thirty days.

### Rounding and the guard rails

`raw` is rounded to whole shekels, then clamped:

```ts
let recommended = Math.round(raw);
if (recommended < input.floor)        { recommended = Math.round(input.floor);   clampedBy = "floor"; }
else if (recommended > input.ceiling) { recommended = Math.round(input.ceiling); clampedBy = "ceiling"; }
```

The floor is the owner's variable cost plus their minimum margin, so the engine can recommend a discount but never one that loses money. The ceiling is owner-set. `clampedBy` is reported in the breakdown so the UI can say the price was held rather than chosen.

### Explaining the price

A multiplier is not an explanation. `explainPrice` (`lib/pricing/waterfall.ts`) decomposes a breakdown into per-factor shekel deltas, applied in the same order the engine applies them:

```ts
const ORDER = ["season", "dow", "leadTime", "occupancy", "event", "lastMinute"];
```

Each step carries the exact running product forward and reports the delta between *rounded* running totals. That is the whole point: `base` plus every delta equals the pre-clamp subtotal exactly, so the waterfall shown to an owner always adds up. `clampDelta` then reports the shekels the floor or ceiling moved it, and is 0 when nothing was clamped.

A worked example with the defaults, for a Friday night in September, 45 days out, forward occupancy 0.5, still open, no holiday, base price 500:

```
base                                 500
season   × 1.10  (September)        +50    550
dow      × 1.25  (Friday)          +138    688
leadTime × 1.00  (31 to 90 days)      0    688
occupancy× 1.00  (0.5, blended)       0    688
event    × 1.00  (no holiday)         0    688
lastMin  × 1.00  (open, 45 days)      0    688

subtotal                                   688
clamp    (floor 300, ceiling 2000)    0
recommended                                688
```

---

## Israel-first by design

The Israeli work week runs Sunday to Thursday. Leisure demand peaks on Thursday and Friday night, and Saturday night softens because Sunday is a work day. The default day-of-week profile encodes that directly: Thursday 1.15, Friday 1.25, Saturday 1.00, with the Monday and Tuesday trough at 0.92.

A pricing model calibrated on a Friday/Saturday weekend gets this backwards in a way that costs real money. It marks Saturday as the peak, when in Israel that is the night demand starts falling off, and it treats Thursday as a mid-week night, when it is one of the two strongest nights of the week. Both errors run in the wrong direction on the two highest-volume nights.

The holiday side is harder than a lookup table. Israeli domestic travel clusters around the Hebrew calendar, which moves against the Gregorian one every year, so no fixed list of dates survives contact with the next year. `lib/calendar/hebcal.ts` resolves each Gregorian date through `@hebcal/core` on the **Israel** schedule rather than the diaspora one, then buckets whatever events fall on that date into a tier: the `CHOL_HAMOED` flag first, then the library's own `major`, `modern` and `minor` categories. Where several events land on one night, the strongest tier wins. No holiday is hard-coded anywhere in this repository.

Holiday names come back rendered in Hebrew without nikud (`he-x-NoNikud`), because that is what reads correctly in the UI, and they are surfaced on the night itself so an owner can see *why* a night is expensive.

The Israeli specificity continues past pricing. `lib/tax/israel.ts` splits a gross price into net and VAT at 18 percent, with a `foreign_tourist` guest type at 0 percent. That zero-rating for private short-term rentals as opposed to licensed hotels is **not legally verified**; the function returns a `verify: true` flag on tourist output precisely so the UI can mark it as provisional rather than quietly presenting it as fact. Dates default to `Asia/Jerusalem` (`todayInTimeZone` in `lib/dates.ts`), which also keeps server and client from disagreeing about what "today" is.

---

## Architecture

The pricing core is pure and side-effect free. The only impure step in the whole pipeline is fetching the iCal feeds.

```
OTA iCal feeds
  -> loadFeeds         one fetch per source, server-only, 15 minute cache, never throws
  -> parseICS          VEVENTs to date ranges (DTEND is exclusive, checkout night is free)
  -> classifySummary   "Reserved" -> booked, "Not available" / "CLOSED" -> blocked
  -> mergeFeeds        one status per night across sources, a booking beats a block
  -> recommendRange    per night: forwardOccupancy over the window, then computePrice
  -> explainPrice      the multiplicative breakdown as whole-shekel deltas
  -> RatesView         eight week grid, per-night why panel, per-source sync report
```

A few decisions worth calling out:

- **Booked versus blocked is load-bearing.** `forwardOccupancy` counts booked nights in the numerator but drops blocked nights from the denominator. Labelling an owner block as a booking invents demand and pushes the price up, so ambiguous feed wording (Booking.com only ever says `CLOSED - Not available`) is treated as a block, which is the conservative choice. Unrecognised wording is treated as a booking, on the reasoning that an unexplained busy night on an OTA calendar is more often a real reservation.
- **One bad feed cannot take down the others.** `loadFeeds` turns a missing env var, a non-200 response or a thrown fetch into a report object rather than an exception, and `mergeFeeds` catches parse failures per source. Every source's outcome is surfaced in the UI so a silent gap is impossible.
- **Feed URLs never reach the client.** They carry access tokens, are read from environment variables named in `config/units.ts`, and `lib/calendar/load.ts` is marked `server-only`. OTA iCal endpoints also send no CORS headers, so the fetch has to happen on the server regardless.
- **Availability crosses the RSC boundary as a plain object**, not a `Map`, because a `Map` is not serializable in React Server Components. `toStatusMap` rebuilds it on the client.
- **Feeds are polled at most every 15 minutes.** OTA calendars refresh every few hours anyway, so polling harder buys nothing.

### Layout

```
app/
  page.tsx            landing (/), renders real engine output, not invented numbers
  landing.tsx         client landing, bilingual he/en via an in-file dictionary
  app/                the product screen (/app): page.tsx, layout.tsx, rates-view.tsx
  rates/page.tsx      redirect to /app
  dev/engine/page.tsx a manual engine playground
config/units.ts       the unit list, shaped 1:1 onto the units table
lib/
  pricing/            config.ts, multipliers.ts, engine.ts, occupancy.ts,
                      recommend.ts, waterfall.ts  (all pure)
  calendar/           load.ts (fetch), feeds.ts (merge), ingest.ts, hebcal.ts
  ical.ts             ical.js parsing plus an outbound VCALENDAR generator
  dates.ts            noon-anchored "YYYY-MM-DD" arithmetic, Asia/Jerusalem default
  tax/israel.ts       VAT split
  db/                 Drizzle schema and client (declared, not yet wired up)
```

The landing page is not a mock-up: it calls `computePrice` at build time to find a real upcoming holiday night and renders the actual waterfall for it.

### Stack

Next.js 16 (App Router) and React 19, TypeScript in strict mode, Tailwind CSS v4 with a token-based light and dark theme resolved before first paint. `@hebcal/core` for the Hebrew calendar, `ical.js` for feed parsing. `drizzle-orm` with `@neondatabase/serverless` for Postgres, present as a schema only. No runtime dependency on any external pricing or scraping service.

---

## Running it

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app boots with no configuration at all. Without any iCal feed it computes prices against an empty calendar, and the sync banner in `/app` says so explicitly rather than presenting the result as trustworthy.

To connect real availability, set the feed URL environment variables named in `config/units.ts` for the unit. The current configuration reads:

| Variable | Purpose |
| --- | --- |
| `ICAL_AIRBNB_URL` | Airbnb export calendar for the unit |
| `ICAL_BOOKING_URL` | Booking.com export calendar for the unit |
| `DATABASE_URL` | Postgres connection string; only read by `lib/db/index.ts`, which nothing imports today |
| `ANTHROPIC_API_KEY` | Reserved for planned LLM event detection; unused |

Adding a feed today means editing `config/units.ts` and setting the corresponding variable. There is no UI for it.

### Scripts

```bash
npm run dev     # next dev
npm run build   # next build
npm start       # next start
npm run lint    # eslint
npm test        # node --import tsx --test "lib/**/*.test.ts"
```

Drizzle commands (`db:generate`, `db:migrate`, `db:push`, `db:studio`) exist in `package.json` but have never been run against this tree; no migrations have been generated.

### Tests

```bash
npm test
```

Tests use the built-in `node:test` runner with `node:assert/strict`, run through `tsx`. There are eight test files, all under `lib/`:

```
lib/dates.test.ts
lib/calendar/feeds.test.ts
lib/calendar/ingest.test.ts
lib/pricing/engine.test.ts
lib/pricing/occupancy.test.ts
lib/pricing/recommend.test.ts
lib/pricing/waterfall.test.ts
lib/tax/israel.test.ts
```

The feed tests pin the behaviour that matters most in production: summary classification per OTA, `DTEND` exclusivity (the checkout night stays free), overlapping spans deduplicating to distinct nights, a reservation outranking a block on the same night, and a dead or unparseable feed degrading to a not-ok report while the other feeds still land. `ingest.test.ts` includes an end-to-end check that a booked night gets a last-minute multiplier of exactly 1 while an open night gets less.

Note that the test glob only covers `lib/`, so any future test outside it would not be picked up.

---

## Status and limitations

smart-rate is a working pricing engine with a real UI on top of it. The engine, the
waterfall explanation and the iCal ingestion are built and tested. The surrounding
product is not finished, and the following is the honest shape of that:

- **Nothing persists yet.** The Drizzle schema is written (10 tables, 5 enums) but no
  code path imports it and no migrations have been generated. Edits in the app live in
  React state and are lost on reload.
- **No authentication and no API surface.** There are no route handlers, no server
  actions and no middleware, so `/app` is public and nothing can be posted to it.
- **Single unit, hard coded.** Everything reads the first entry in `config/units.ts`,
  despite a multi-tenant schema.
- **Prices are never pushed to the OTAs.** Airbnb and Booking expose no price-push API,
  so applying a recommendation is a manual copy. The UI says so directly.
- **The outbound iCal feed is generated but not served.** `generateICalendar` produces a
  valid VCALENDAR; no route exposes it yet.

A fuller engineering account, including known rough edges in the engine and the feed
parser, is kept in [ROADMAP.md](ROADMAP.md).
