// Integration tests against the real kvartirabooks.org REST APIs backing
// events (eep/v1/events and wp/v2/etn). Skipped automatically if the site
// is unreachable, but otherwise run as part of `npm test`.

import { describe, expect, it } from "vitest";
import { EventsClient, toEventSummary } from "./eventsClient.js";

const client = new EventsClient();

async function isSiteReachable(): Promise<boolean> {
  try {
    const res = await fetch("https://kvartirabooks.org/wp-json/eep/v1/events?per_page=1");
    return res.ok;
  } catch {
    return false;
  }
}

const siteReachable = await isSiteReachable();

describe.skipIf(!siteReachable)("kvartirabooks.org live events API", () => {
  it(
    "searches upcoming events and derives a schedule for each result",
    async () => {
      const data = await client.searchEvents({ query: "книжный клуб", perPage: 5 });
      expect(data.events.length).toBeGreaterThan(0);
      for (const summary of data.events.map(toEventSummary)) {
        expect(summary.schedule.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    },
    15000,
  );

  it(
    "filters by a known category slug",
    async () => {
      const data = await client.searchEvents({ category: "childrens-events-in-english", perPage: 5 });
      expect(data.events.length).toBeGreaterThan(0);
      for (const event of data.events) {
        expect(event.categories.map((c) => c.slug)).toContain("childrens-events-in-english");
      }
    },
    15000,
  );

  it(
    "getEventDetail merges the post description with its live schedule for an upcoming event",
    async () => {
      const search = await client.searchEvents({ query: "книжный клуб", perPage: 1 });
      const target = search.events[0];
      expect(target).toBeDefined();

      const detail = await client.getEventDetail(target.id);
      expect(detail).not.toBeNull();
      expect(detail!.id).toBe(target.id);
      expect(detail!.descriptionHtml.length).toBeGreaterThan(0);
      expect(detail!.schedule).not.toBeNull();
      expect(detail!.schedule!.startDate).toBe(target.start_date);
    },
    20000,
  );

  it(
    "getEventDetail returns null for a nonexistent event ID",
    async () => {
      const detail = await client.getEventDetail(1);
      expect(detail).toBeNull();
    },
    15000,
  );
});
