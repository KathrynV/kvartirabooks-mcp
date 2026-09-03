// Shapes returned by the two public REST surfaces this server combines for
// events (kvartirabooks.org runs the Eventin plugin):
//
// - GET /wp-json/eep/v1/events   ("Eventin Events Page" companion plugin)
//   Public, structured, but upcoming-events-only and has no single-item
//   lookup by ID. Used for search and for schedule/price/location data.
// - GET /wp-json/wp/v2/etn/{id}  (standard WP post-type REST controller)
//   Public, has the full description for any event regardless of date,
//   but no date/time/venue/price fields.

export interface EepCategory {
  name: string;
  slug: string;
}

export interface EepEvent {
  id: number;
  title: string;
  excerpt: string;
  permalink: string;
  thumbnail: string | null;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  location: string;
  event_type: "online" | "offline";
  categories: EepCategory[];
  prices: number[];
}

export interface EepEventsResponse {
  events: EepEvent[];
  total: number;
  total_pages: number;
  page: number;
}

export interface EtnEmbeddedTerm {
  id: number;
  name: string;
  slug: string;
  taxonomy: string;
}

export interface EtnPost {
  id: number;
  slug: string;
  status: string;
  link: string;
  date: string;
  modified: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  featured_media: number;
  etn_category: number[];
  etn_tags: number[];
  _embedded?: {
    "wp:featuredmedia"?: Array<{ source_url: string }>;
    "wp:term"?: EtnEmbeddedTerm[][];
  };
}

// Simplified shapes returned by this MCP server's tools.

export interface EventCategory {
  name: string;
  slug: string;
}

export interface EventSchedule {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string;
  eventType: "online" | "offline";
  prices: number[];
  isFree: boolean;
}

export interface EventSummary {
  id: number;
  title: string;
  excerpt: string;
  permalink: string;
  thumbnail: string | null;
  categories: EventCategory[];
  schedule: EventSchedule;
}

export interface EventDetail {
  id: number;
  title: string;
  permalink: string;
  descriptionHtml: string;
  categories: EventCategory[];
  tags: string[];
  featuredImage: string | null;
  publishedDate: string;
  modifiedDate: string;
  // null when the event has already happened and dropped out of the
  // upcoming-events feed that carries date/time/venue/price data.
  schedule: EventSchedule | null;
}

export interface SearchEventsResult {
  query: string;
  category: string | null;
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  events: EventSummary[];
}
