import "server-only";
import type { UnitConfig } from "@/config/units";
import type { RawFeed } from "./feeds";

/** How long a cached feed response stays fresh (seconds). */
export const FEED_REVALIDATE_SECONDS = 900;

/**
 * Pull every configured iCal feed for a unit.
 *
 * The only impure step in the calendar pipeline, and deliberately total: each
 * source is isolated, so a dead or misconfigured feed is reported rather than
 * thrown, and never takes the other sources down with it.
 *
 * Server-only — these URLs carry access tokens and must never reach the client.
 */
export async function loadFeeds(unit: UnitConfig): Promise<RawFeed[]> {
  return Promise.all(
    unit.feeds.map(async (feed): Promise<RawFeed> => {
      const url = process.env[feed.urlEnv];
      if (!url) {
        return { source: feed.source, ics: null, error: "not configured" };
      }
      try {
        const res = await fetch(url, { next: { revalidate: FEED_REVALIDATE_SECONDS } });
        if (!res.ok) {
          return { source: feed.source, ics: null, error: `HTTP ${res.status}` };
        }
        return { source: feed.source, ics: await res.text() };
      } catch (e) {
        return {
          source: feed.source,
          ics: null,
          error: e instanceof Error ? e.message : "unreachable",
        };
      }
    }),
  );
}
