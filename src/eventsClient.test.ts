import { describe, expect, it, vi } from "vitest";
import {
  EventsClient,
  toEventDetail,
  toEventSchedule,
  toEventSummary,
  toSearchEventsResult,
} from "./eventsClient.js";
import { KvartiraBooksApiError } from "./errors.js";
import { eventPost, freeOnlineEepEvent, upcomingEepEvent } from "./__fixtures__/events.js";

function jsonResponse(body: unknown, init: { status?: number } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

describe("toEventSchedule", () => {
  it("maps a paid event and marks it not free", () => {
    const schedule = toEventSchedule(upcomingEepEvent);
    expect(schedule).toMatchObject({
      startDate: "2026-09-13",
      startTime: "6:00 PM",
      eventType: "offline",
      prices: [30],
      isFree: false,
    });
  });

  it("marks an event with no prices as free", () => {
    const schedule = toEventSchedule(freeOnlineEepEvent);
    expect(schedule.isFree).toBe(true);
    expect(schedule.eventType).toBe("online");
  });
});

describe("toEventSummary / toSearchEventsResult", () => {
  it("decodes HTML entities and nests the schedule", () => {
    const summary = toEventSummary(upcomingEepEvent);
    expect(summary.id).toBe(87753);
    expect(summary.title).toBe("Книжный клуб с Ксенией Мироновой");
    expect(summary.schedule.location).toBe("731 Washington Ave, Brooklyn, NY 11238, USA");
  });

  it("carries query/category/pagination through to the result", () => {
    const result = toSearchEventsResult("книжный клуб", "adult-events-in-russian", 1, 10, {
      events: [upcomingEepEvent],
      total: 8,
      total_pages: 1,
      page: 1,
    });
    expect(result.query).toBe("книжный клуб");
    expect(result.category).toBe("adult-events-in-russian");
    expect(result.total).toBe(8);
    expect(result.events).toHaveLength(1);
  });
});

describe("toEventDetail", () => {
  it("strips HTML from the description and pulls terms from the embed", () => {
    const detail = toEventDetail(eventPost, null);
    expect(detail.descriptionHtml).toBe("Читаем, обсуждаем, спорим (на русском языке)");
    expect(detail.categories).toEqual([{ name: "Adult Events in Russian", slug: "adult-events-in-russian" }]);
    expect(detail.tags).toEqual([]);
    expect(detail.featuredImage).toBe(
      "https://kvartirabooks.org/wp-content/uploads/knizhnyj-klub-s-kseniej-mironovoj.webp",
    );
  });

  it("sets schedule to null when no matching upcoming occurrence was found", () => {
    const detail = toEventDetail(eventPost, null);
    expect(detail.schedule).toBeNull();
  });

  it("nests the schedule when a matching upcoming occurrence was found", () => {
    const detail = toEventDetail(eventPost, upcomingEepEvent);
    expect(detail.schedule).toMatchObject({ startDate: "2026-09-13", isFree: false });
  });
});

describe("EventsClient", () => {
  it("searchEvents forwards query, category, and pagination params", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ events: [upcomingEepEvent], total: 1, total_pages: 1, page: 1 }),
    );
    const client = new EventsClient({ fetchImpl });

    await client.searchEvents({ query: "книжный клуб", category: "adult-events-in-russian", page: 2, perPage: 5 });

    const calledUrl = new URL(fetchImpl.mock.calls[0][0] as string);
    expect(calledUrl.pathname).toBe("/wp-json/eep/v1/events");
    expect(calledUrl.searchParams.get("search")).toBe("книжный клуб");
    expect(calledUrl.searchParams.get("category")).toBe("adult-events-in-russian");
    expect(calledUrl.searchParams.get("page")).toBe("2");
    expect(calledUrl.searchParams.get("per_page")).toBe("5");
  });

  it("searchEvents omits search/category params when not provided", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ events: [], total: 0, total_pages: 0, page: 1 }));
    const client = new EventsClient({ fetchImpl });

    await client.searchEvents({});

    const calledUrl = new URL(fetchImpl.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.has("search")).toBe(false);
    expect(calledUrl.searchParams.has("category")).toBe(false);
  });

  it("searchEvents throws KvartiraBooksApiError on a non-OK response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 500, statusText: "Server Error" }));
    const client = new EventsClient({ fetchImpl });

    await expect(client.searchEvents({})).rejects.toBeInstanceOf(KvartiraBooksApiError);
  });

  it("getEventPost returns null on 404", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    const client = new EventsClient({ fetchImpl });

    expect(await client.getEventPost(1)).toBeNull();
  });

  it("getEventPost requests with _embed=1", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(eventPost));
    const client = new EventsClient({ fetchImpl });

    await client.getEventPost(87753);

    const calledUrl = fetchImpl.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/wp/v2/etn/87753");
    expect(calledUrl).toContain("_embed=1");
  });

  it("findEventSchedule finds a match on the first page of title search results", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ events: [upcomingEepEvent], total: 1, total_pages: 1, page: 1 }),
    );
    const client = new EventsClient({ fetchImpl });

    const found = await client.findEventSchedule(87753, "Книжный клуб с Ксенией Мироновой");
    expect(found?.id).toBe(87753);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("findEventSchedule pages through results looking for the exact ID", async () => {
    const otherEvent = { ...upcomingEepEvent, id: 1 };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ events: [otherEvent], total: 2, total_pages: 2, page: 1 }))
      .mockResolvedValueOnce(jsonResponse({ events: [upcomingEepEvent], total: 2, total_pages: 2, page: 2 }));
    const client = new EventsClient({ fetchImpl });

    const found = await client.findEventSchedule(87753, "Книжный клуб с Ксенией Мироновой");
    expect(found?.id).toBe(87753);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("findEventSchedule returns null when the event has already happened", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ events: [], total: 0, total_pages: 1, page: 1 }));
    const client = new EventsClient({ fetchImpl });

    expect(await client.findEventSchedule(999999, "Some past event")).toBeNull();
  });

  it("getEventDetail returns null when the post itself doesn't exist", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    const client = new EventsClient({ fetchImpl });

    expect(await client.getEventDetail(1)).toBeNull();
  });

  it("getEventDetail merges the post with a matching schedule", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(eventPost))
      .mockResolvedValueOnce(jsonResponse({ events: [upcomingEepEvent], total: 1, total_pages: 1, page: 1 }));
    const client = new EventsClient({ fetchImpl });

    const detail = await client.getEventDetail(87753);
    expect(detail?.schedule).toMatchObject({ startDate: "2026-09-13" });
    expect(detail?.descriptionHtml).toContain("Читаем, обсуждаем, спорим");
  });
});
