# Roadmap and known limitations

A working log of what is not finished and what is known to be wrong. Kept out of the
README so that document stays about what the project is and how the pricing model works.

## Status and limitations

This is a working pricing engine with a real UI on top of it, and a substantial amount of scaffolding that is not yet connected. The following is deliberately complete.

### Not built yet

- **No authentication of any kind.** There is no middleware, no login page, no session, and `/app` is fully public. The landing page's sign-in link is a plain navigation to `/app`. A `users` table with a `password_hash` column exists in the schema, and `bcryptjs` and `jose` are installed, but no auth code has been written.
- **No API surface.** Zero route handlers, zero server actions, zero middleware. The app is render plus client-side recompute; nothing can be POSTed to.
- **Nothing persists.** The Drizzle schema (10 tables, 5 enums) is written but no code path imports `lib/db`. No migrations have been generated (`out: "./drizzle"` is configured, the directory does not exist), there is no seed script, and the tables have never been created. Editing base price, variable cost, margin or ceiling in `/app` lives in React state and is lost on reload. `price_recommendations` is never written; recommendations are recomputed on every render.
- **Single unit, hard-coded.** Everything reads `UNITS[0]` from `config/units.ts`. There is no `/app/[unitId]` route and no unit switcher, despite a multi-tenant `properties`/`units` schema.
- **The outbound iCal feed is written but not served.** `generateICalendar` in `lib/ical.ts` produces a valid VCALENDAR so an owner's manual blocks could be pushed back to Airbnb and Booking, but no route exposes it. The `channels.export_token` column implies the same feature.
- **No calendar-connection UI**, despite the landing copy describing a three-step onboarding.
- **No LLM event detection.** The `event_source` enum reserves an `llm` value and `.env.example` reserves an API key, but there is no LLM code and no events ingestion path.
- **Prices are never pushed to the OTAs.** Airbnb and Booking have no open price-push API, so updating the price is a manual copy from the why-panel. The UI says this outright.
- **The pricing section of the landing page is an explicit placeholder** with no number in it. There is no billing, no plan model and no payment integration. The footer's Privacy, Terms and Contact are plain text, not links.
- **`lib/calendar/ingest.ts` is a parallel, unwired ingestion path** used only by its own test. The live path is `loadFeeds` plus `mergeFeeds`. Only its `ThinBooking` type is used in production code.
- **Five of eleven runtime dependencies are unused**: `zod`, `date-fns`, `bcryptjs` and `jose` are imported by no file, and `@neondatabase/serverless` only by the unused DB client.
- **`/dev/engine` ships in the public app router.** It is not env-gated or excluded from the build, so it is reachable in production, and it still uses raw Tailwind classes instead of the design tokens the rest of the app moved to.

### Known rough edges in the engine

- **No input validation anywhere.** Nothing checks that `basePrice > 0`, that `forwardOccupancy` is within 0..1, that `leadTimeDays >= 0`, or that values are finite. A `NaN` in any factor propagates straight through to `recommended: NaN` with `clampedBy: null`.
- **`floor > ceiling` is not detected.** The clamp is an `if`/`else if`, so a below-floor price is lifted to the floor and never re-checked against the ceiling. The result can exceed the ceiling while reporting `clampedBy: "floor"`, and there is no "invalid" state in the union.
- **The clamp compares a rounded price against unrounded bounds**, and echoes `floor` and `ceiling` back into the breakdown unrounded even when the recommendation was clamped to their rounded value.
- **Config overrides are a shallow spread.** Passing a partial `occupancyBands` or `leadTimeBands` through `input.config` replaces the entire default array rather than merging into it. Band arrays are assumed to be sorted ascending by `upTo` and are never sorted or validated.
- **Occupancy outside 0..1 does not error.** A value above 1.0 falls through to the last band; a negative value lands in the lowest.
- **The `manualEventMultiplier >= 1` contract is documentation only.** A value below 1 is accepted and simply loses the `max` against the tier multiplier, so a manual event can never discount.
- **Rounding is a bare `Math.round` to whole units.** There is no currency field on the engine, no psychological or increment rounding, and no minimum-change threshold.
- **Timezone.** `date.getDay()` and `date.getMonth()` are local-time reads, so the season and day-of-week factors depend on the server's local timezone. Callers work around this by constructing dates at local noon. `todayInTimeZone` pins Asia/Jerusalem via `Intl` while the date arithmetic helpers use local time, so the two use different clocks.
- **The waterfall's factor order is a hand-maintained duplicate** of the engine's application order. Nothing ties them together at runtime, so a seventh multiplier would widen the type, be silently omitted from the decomposition, and have its contribution land in `clampDelta` instead of a step.
- **Fast days are currently tiered as demand peaks.** The Hebrew calendar tier map treats them like other minor holidays, which is wrong for pricing. The landing page works around it by anchoring its example on a named festival rather than the priciest night in the year.
- **The tier classification has an internal inconsistency**: an event carrying the `CHOL_HAMOED` flag is classified `cholHamoed` even when it is also categorised `major`, and `major` outranks `cholHamoed` in the tier ranking. No test pins the intended behaviour.
- **`occupancyWeight` is meant to grow with the property's own booking history.** Nothing updates it; it is a static config value.

### Feed parsing caveats

- **Availability status is decided purely by matching free text in the `SUMMARY` field.** There is no per-source override and no handling of localised summaries. Any unrecognised wording silently becomes `booked`.
- **No recurrence expansion.** `parseICS` reads each VEVENT's start and end and never looks at `RRULE` or `RECURRENCE-ID`, so a recurring block contributes only its first span. It also ignores `STATUS` (including `CANCELLED`) and does no TZID or UTC-offset conversion.
- **Per-source booked and blocked counts are order-dependent.** They are read back off the merged status map, so a night one source called blocked is counted as booked in that source's own report if an earlier source already marked it booked. `FeedReport.nights` counts that source's own nights, so the three numbers do not necessarily describe the same view. No test covers this.
- **Duplicate bookings across sources are not deduplicated** in the bookings array (the night-level status map is deduplicated by date).
- **There are no route-level `loading`, `error` or `not-found` boundaries** anywhere under `app/`. The only failure surface for a bad feed is the per-source text in the sync banner.
- **The 15 minute revalidation literal in `app/app/page.tsx` is kept in step with `FEED_REVALIDATE_SECONDS` by comment only.** Nothing enforces the match.

### Other

- **Localisation is partial.** Only the landing page is bilingual, through a client-side toggle over an in-file dictionary. `/app` and `/dev/engine` are Hebrew-only hard-coded strings, there is no i18n routing, and `<html lang="he" dir="rtl">` stays fixed even when the landing switches to English.
- **The tax module covers VAT only.** There is no income tax, arnona, tourism levy, withholding or rounding logic, and the foreign-tourist zero rate is explicitly unverified.
- **No tests exist** for `lib/calendar/hebcal.ts`, `lib/calendar/load.ts`, the `lib/ical.ts` exports, or anything under `app/`.

---

Built by Yonatan Volsky.
