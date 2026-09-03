import type { EepEvent, EtnPost } from "../eventTypes.js";

// Trimmed, representative fixtures mirroring the real responses for
// event id 87753 ("Книжный клуб с Ксенией Мироновой") from
// GET /wp-json/eep/v1/events?search=... and GET /wp-json/wp/v2/etn/87753?_embed=1

export const upcomingEepEvent: EepEvent = {
  id: 87753,
  title: "Книжный клуб с Ксенией Мироновой",
  excerpt: "Читаем, обсуждаем, спорим (на русском языке)…",
  permalink: "https://kvartirabooks.org/etn/knizhnyj-klub-s-kseniej-mironovoj-2-2/knizhnyj-klub-s-kseniej-mironovoj/",
  thumbnail: "https://kvartirabooks.org/wp-content/uploads/knizhnyj-klub-s-kseniej-mironovoj-600x300.webp",
  start_date: "2026-09-13",
  end_date: "2026-09-13",
  start_time: "6:00 PM",
  end_time: "9:00 PM",
  location: "731 Washington Ave, Brooklyn, NY 11238, USA",
  event_type: "offline",
  categories: [{ name: "Adult Events in Russian", slug: "adult-events-in-russian" }],
  prices: [30],
};

export const freeOnlineEepEvent: EepEvent = {
  ...upcomingEepEvent,
  id: 90000,
  event_type: "online",
  prices: [],
};

export const eventPost: EtnPost = {
  id: 87753,
  slug: "knizhnyj-klub-s-kseniej-mironovoj",
  status: "publish",
  link: "https://kvartirabooks.org/etn/knizhnyj-klub-s-kseniej-mironovoj-2-2/knizhnyj-klub-s-kseniej-mironovoj/",
  date: "2026-08-20T19:08:35",
  modified: "2026-08-31T23:06:27",
  title: { rendered: "Книжный клуб с Ксенией Мироновой" },
  content: { rendered: "<p>Читаем, обсуждаем, спорим <strong>(на русском языке)</strong></p>" },
  excerpt: { rendered: "<p>Читаем, обсуждаем, спорим&#8230;</p>" },
  featured_media: 83228,
  etn_category: [7431],
  etn_tags: [],
  _embedded: {
    "wp:featuredmedia": [
      { source_url: "https://kvartirabooks.org/wp-content/uploads/knizhnyj-klub-s-kseniej-mironovoj.webp" },
    ],
    "wp:term": [
      [{ id: 7431, name: "Adult Events in Russian", slug: "adult-events-in-russian", taxonomy: "etn_category" }],
      [],
    ],
  },
};
