import { UNITS } from "@/config/units";
import { loadFeeds } from "@/lib/calendar/load";
import { mergeFeeds } from "@/lib/calendar/feeds";
import { todayInTimeZone } from "@/lib/dates";
import RatesClient from "./rates-client";

/**
 * Feeds are re-pulled at most every 15 minutes. OTA iCal endpoints only refresh
 * every few hours anyway, so polling harder buys nothing and is rude to them.
 */
// Must be a literal — Next only accepts static values for segment config.
// Keep in step with FEED_REVALIDATE_SECONDS in lib/calendar/load.ts.
export const revalidate = 900;

/**
 * Server shell for the rate calendar.
 *
 * The fetch has to happen here, not in the browser: OTA iCal endpoints send no
 * CORS headers, and the feed URLs carry access tokens that must never reach the
 * client. Availability crosses to the client as a plain object, since a Map is
 * not serializable across the RSC boundary.
 */
export default async function RatesPage() {
  const unit = UNITS[0];
  const feeds = await loadFeeds(unit);
  const { statusByDate, perSource } = mergeFeeds(feeds);

  return (
    <RatesClient
      unitName={unit.name}
      economics={unit.economics}
      statusByDate={statusByDate}
      perSource={perSource}
      fetchedAt={new Date().toISOString()}
      today={todayInTimeZone()}
    />
  );
}
