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
import {
  ORDER_STATUSES,
  OrdersClient,
  toCustomerOrdersResult,
  toSearchCustomersResult,
} from "./ordersClient.js";

const client = new KvartiraBooksClient();
const eventsClient = new EventsClient();
const ordersClient = new OrdersClient({
  consumerKey: process.env.WC_CONSUMER_KEY,
  consumerSecret: process.env.WC_CONSUMER_SECRET,
});

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

server.registerTool(
  "search_customers",
  {
    title: "Search customers",
    description:
      "Look up a kvartirabooks.org customer by email (exact match) or name (fuzzy match), " +
      "returning their numeric customer ID for use with get_customer_orders. Requires " +
      "WC_CONSUMER_KEY/WC_CONSUMER_SECRET to be configured (WooCommerce Admin -> Settings -> " +
      "Advanced -> REST API); this reveals customer PII, so it's for internal/store-owner use.",
    inputSchema: {
      query: z.string().min(1).describe("Customer email or name to search for"),
    },
  },
  async ({ query }) => {
    try {
      const customers = await ordersClient.searchCustomers(query);
      const result = toSearchCustomersResult(query, customers);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.registerTool(
  "get_customer_orders",
  {
    title: "Get customer order history",
    description:
      "Fetch a customer's order history by numeric customer ID (from search_customers), " +
      "including line items and each item's availability ('for_sale' vs 'for_borrow' based on " +
      "its SKU). This store's library lending is implemented as orders with custom statuses: " +
      "'books-on-hand' (currently checked out), 'returned', 'return-initiated', and " +
      "'shipment-lost', alongside standard WooCommerce statuses like 'completed'. Requires " +
      "WC_CONSUMER_KEY/WC_CONSUMER_SECRET to be configured.",
    inputSchema: {
      customerId: z.number().int().positive().describe("Numeric customer ID"),
      status: z.enum(ORDER_STATUSES).optional().describe("Filter to one order status"),
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
  async ({ customerId, status, page, perPage }) => {
    try {
      const data = await ordersClient.getCustomerOrders(customerId, { status, page, perPage });
      const result = toCustomerOrdersResult(customerId, status ?? null, page, perPage, data);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
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
