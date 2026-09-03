#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  KvartiraBooksApiError,
  KvartiraBooksClient,
  toBookDetail,
  toSearchResult,
} from "./client.js";
import { EVENT_CATEGORY_SLUGS, EventsClient, toSearchEventsResult } from "./eventsClient.js";

const client = new KvartiraBooksClient();
const eventsClient = new EventsClient();

const server = new McpServer({
  name: "kvartirabooks-mcp",
  version: "0.1.0",
});

server.registerTool(
  "search_books",
  {
    title: "Search books",
    description:
      "Search kvartirabooks.org's catalog by title, author, or ISBN/SKU. " +
      "The same book can appear twice: once as a for-sale copy (SKU is the plain ISBN) " +
      "and once as a library copy available to borrow (SKU has a '-L' suffix). " +
      "Each result's 'availability' field is 'for_sale', 'for_borrow', or 'unknown'.",
    inputSchema: {
      query: z.string().min(1).describe("Search text: title, author, or ISBN"),
      page: z.number().int().min(1).default(1).describe("1-based page number"),
      perPage: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(10)
        .describe("Results per page (max 100)"),
      availability: z
        .enum(["any", "for_sale", "for_borrow"])
        .default("any")
        .describe(
          "Filter results on the returned page only, by 'for_sale' or 'for_borrow'; " +
            "does not change pagination totals.",
        ),
    },
  },
  async ({ query, page, perPage, availability }) => {
    try {
      const data = await client.searchProducts({ query, page, perPage });
      const result = toSearchResult(query, page, perPage, data);
      if (availability !== "any") {
        result.books = result.books.filter((b) => b.availability === availability);
      }
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.registerTool(
  "get_book",
  {
    title: "Get book details",
    description:
      "Fetch full details for a single book by its numeric product ID or its exact SKU. " +
      "Provide exactly one of 'id' or 'sku'. Note that for-sale and for-borrow copies of " +
      "the same title have different IDs and SKUs (the borrow copy's SKU ends in '-L').",
    inputSchema: {
      id: z.number().int().positive().optional().describe("Numeric product ID"),
      sku: z
        .string()
        .min(1)
        .optional()
        .describe("Exact SKU, e.g. '9785041817558' (for sale) or '9785041817558-L' (to borrow)"),
    },
  },
  async ({ id, sku }) => {
    if ((id === undefined) === (sku === undefined)) {
      return {
        isError: true,
        content: [{ type: "text", text: "Provide exactly one of 'id' or 'sku'." }],
      };
    }
    try {
      const product = id !== undefined
        ? await client.getProductById(id)
        : await client.getProductBySku(sku!);

      if (!product) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `No book found for ${id !== undefined ? `id=${id}` : `sku=${sku}`}.`,
            },
          ],
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(toBookDetail(product), null, 2) }],
      };
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.registerTool(
  "search_events",
  {
    title: "Search events",
    description:
      "Search kvartirabooks.org's upcoming events (readings, book clubs, kids' events, etc). " +
      "Only events that haven't happened yet are returned. Provide 'query', 'category', or both " +
      "(omitting 'query' browses a category's full upcoming schedule).",
    inputSchema: {
      query: z.string().optional().describe("Search text: event title or description"),
      category: z
        .enum(EVENT_CATEGORY_SLUGS)
        .optional()
        .describe("Filter to one event category"),
      page: z.number().int().min(1).default(1).describe("1-based page number"),
      perPage: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(10)
        .describe("Results per page (max 100)"),
    },
  },
  async ({ query, category, page, perPage }) => {
    try {
      const data = await eventsClient.searchEvents({ query, category, page, perPage });
      const result = toSearchEventsResult(query ?? "", category ?? null, page, perPage, data);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.registerTool(
  "get_event",
  {
    title: "Get event details",
    description:
      "Fetch full details for a single event by its numeric ID, including its full " +
      "description. If the event is still upcoming, this also includes its 'schedule' " +
      "(date, time, venue, prices); if the event has already happened, 'schedule' is null " +
      "since kvartirabooks.org only publishes schedule data for upcoming events.",
    inputSchema: {
      id: z.number().int().positive().describe("Numeric event ID"),
    },
  },
  async ({ id }) => {
    try {
      const detail = await eventsClient.getEventDetail(id);
      if (!detail) {
        return {
          isError: true,
          content: [{ type: "text", text: `No event found for id=${id}.` }],
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(detail, null, 2) }],
      };
    } catch (err) {
      return errorResult(err);
    }
  },
);

function errorResult(err: unknown) {
  const message = err instanceof KvartiraBooksApiError
    ? err.message
    : err instanceof Error
      ? err.message
      : String(err);
  return {
    isError: true,
    content: [{ type: "text" as const, text: `kvartirabooks-mcp error: ${message}` }],
  };
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error starting kvartirabooks-mcp:", err);
  process.exit(1);
});
