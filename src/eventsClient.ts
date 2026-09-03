import type {
  EepEvent,
  EepEventsResponse,
  EtnPost,
  EventCategory,
  EventDetail,
  EventSchedule,
  EventSummary,
  SearchEventsResult,
} from "./eventTypes.js";
import { KvartiraBooksApiError } from "./errors.js";
import { decodeHtmlEntities, stripHtml } from "./html.js";

const DEFAULT_BASE_URL = "https://kvartirabooks.org/wp-json";

// The only categories the eep/v1/categories endpoint currently returns.
// Kept here (rather than fetched live) so the MCP tool schema can offer a
// fixed enum; searchEvents still just forwards whatever slug it's given.
export const EVENT_CATEGORY_SLUGS = [
  "adult-events-in-russian",
  "adult-events-in-english",
  "childrens-events-in-russian",
  "childrens-events-in-english",
] as const;

export interface EventsClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class EventsClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: EventsClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  // GET /eep/v1/events — public, structured, upcoming events only, no
  // lookup-by-ID. This is the only source of date/time/venue/price.
  async searchEvents(params: {
    query?: string;
    category?: string;
    page?: number;
    perPage?: number;
  }): Promise<EepEventsResponse> {
    const url = new URL(`${this.baseUrl}/eep/v1/events`);
    if (params.query) url.searchParams.set("search", params.query);
    if (params.category) url.searchParams.set("category", params.category);
    url.searchParams.set("page", String(params.page ?? 1));
    url.searchParams.set("per_page", String(params.perPage ?? 10));

    const res = await this.fetchImpl(url.toString());
    if (!res.ok) {
      throw new KvartiraBooksApiError(
        `Event search request failed: ${res.status} ${res.statusText}`,
        res.status,
      );
    }
    return (await res.json()) as EepEventsResponse;
  }

  // GET /wp/v2/etn/{id} — public, has the full description for any event
  // regardless of date, but no schedule/venue/price fields.
  async getEventPost(id: number): Promise<EtnPost | null> {
    const url = `${this.baseUrl}/wp/v2/etn/${id}?_embed=1`;
    const res = await this.fetchImpl(url);
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      throw new KvartiraBooksApiError(
        `Get event request failed: ${res.status} ${res.statusText}`,
        res.status,
      );
    }
    return (await res.json()) as EtnPost;
  }

  // There is no public "get event schedule by ID" endpoint. Recurring
  // events (e.g. a monthly book club) share the same title across separate
  // IDs, so searching /eep/v1/events by title reliably narrows to a small
  // result set; we then match the exact ID within it. Bounded to a few
  // pages so a generic title can't force scanning the whole catalog.
  // Returns null when the event has already happened and dropped out of
  // the upcoming-events feed.
  async findEventSchedule(id: number, title: string): Promise<EepEvent | null> {
    const perPage = 50;
    const maxPages = 5;
    for (let page = 1; page <= maxPages; page += 1) {
      const data = await this.searchEvents({ query: title, page, perPage });
      const match = data.events.find((e) => e.id === id);
      if (match) return match;
      if (page >= data.total_pages) break;
    }
    return null;
  }

  async getEventDetail(id: number): Promise<EventDetail | null> {
    const post = await this.getEventPost(id);
    if (!post) return null;
    const title = decodeHtmlEntities(post.title.rendered);
    const schedule = await this.findEventSchedule(id, title);
    return toEventDetail(post, schedule);
  }
}

export function toEventSchedule(event: EepEvent): EventSchedule {
  return {
    startDate: event.start_date,
    endDate: event.end_date,
    startTime: event.start_time,
    endTime: event.end_time,
    location: event.location,
    eventType: event.event_type,
    prices: event.prices,
    isFree: event.prices.length === 0,
  };
}

export function toEventSummary(event: EepEvent): EventSummary {
  return {
    id: event.id,
    title: decodeHtmlEntities(event.title),
    excerpt: decodeHtmlEntities(event.excerpt),
    permalink: event.permalink,
    thumbnail: event.thumbnail,
    categories: event.categories,
    schedule: toEventSchedule(event),
  };
}

export function toSearchEventsResult(
  query: string,
  category: string | null,
  page: number,
  perPage: number,
  data: EepEventsResponse,
): SearchEventsResult {
  return {
    query,
    category,
    page,
    perPage,
    total: data.total,
    totalPages: data.total_pages,
    events: data.events.map(toEventSummary),
  };
}

function embeddedTerms(post: EtnPost, taxonomy: string): EventCategory[] {
  const groups = post._embedded?.["wp:term"] ?? [];
  return groups
    .flat()
    .filter((term) => term.taxonomy === taxonomy)
    .map((term) => ({ name: decodeHtmlEntities(term.name), slug: term.slug }));
}

export function toEventDetail(post: EtnPost, schedule: EepEvent | null): EventDetail {
  return {
    id: post.id,
    title: decodeHtmlEntities(post.title.rendered),
    permalink: post.link,
    descriptionHtml: stripHtml(post.content.rendered),
    categories: embeddedTerms(post, "etn_category"),
    tags: embeddedTerms(post, "etn_tags").map((t) => t.slug),
    featuredImage: post._embedded?.["wp:featuredmedia"]?.[0]?.source_url ?? null,
    publishedDate: post.date,
    modifiedDate: post.modified,
    schedule: schedule ? toEventSchedule(schedule) : null,
  };
}
