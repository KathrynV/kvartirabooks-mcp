// Integration tests against the real kvartirabooks.org WooCommerce v3 API.
// Requires WC_CONSUMER_KEY/WC_CONSUMER_SECRET (see README) — skipped
// automatically if they aren't set, or if the site is unreachable, so this
// suite never needs a real secret committed anywhere.

import { describe, expect, it } from "vitest";
import { OrdersClient } from "./ordersClient.js";
import { deriveAvailabilityFromSku } from "./availability.js";
import type { WcOrder } from "./orderTypes.js";

const consumerKey = process.env.WC_CONSUMER_KEY;
const consumerSecret = process.env.WC_CONSUMER_SECRET;
const hasCredentials = Boolean(consumerKey && consumerSecret);

// A direct, unscoped GET (bypassing OrdersClient, which is intentionally
// scoped to a single customer per the get_customer_orders tool design) so
// this test doesn't need to name a specific real customer.
async function fetchRecentOrders(limit: number): Promise<WcOrder[]> {
  const token = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const res = await fetch(
    `https://kvartirabooks.org/wp-json/wc/v3/orders?per_page=${limit}&orderby=date&order=desc`,
    { headers: { Authorization: `Basic ${token}` } },
  );
  if (!res.ok) throw new Error(`unexpected ${res.status}`);
  return (await res.json()) as WcOrder[];
}

async function isAuthReachable(): Promise<boolean> {
  if (!hasCredentials) return false;
  try {
    await fetchRecentOrders(1);
    return true;
  } catch {
    return false;
  }
}

// Guest checkouts (customer_id: 0) are common; several tests need a real
// registered customer, so scan a larger page rather than assuming the
// single most recent order has one.
async function findRecentOrderWithCustomer(): Promise<WcOrder> {
  const orders = await fetchRecentOrders(20);
  const withCustomer = orders.find((o) => o.customer_id > 0);
  if (!withCustomer) throw new Error("no recent order with a registered customer found");
  return withCustomer;
}

const canRun = await isAuthReachable();

describe.skipIf(!canRun)("kvartirabooks.org live orders API", () => {
  it(
    "finds real recent orders and each line item resolves a known availability value",
    async () => {
      const orders = await fetchRecentOrders(5);
      expect(orders.length).toBeGreaterThan(0);

      for (const order of orders) {
        for (const item of order.line_items) {
          // "unknown" covers non-book line items (fees, gift cards, products with no SKU).
          expect(["for_sale", "for_borrow", "unknown"]).toContain(deriveAvailabilityFromSku(item.sku));
        }
      }
    },
    15000,
  );

  it(
    "getCustomerOrders scopes results to a single customer and matches a known order status",
    async () => {
      const client = new OrdersClient({ consumerKey, consumerSecret });
      const recent = await findRecentOrderWithCustomer();

      const { orders } = await client.getCustomerOrders(recent.customer_id, { perPage: 20 });
      expect(orders.length).toBeGreaterThan(0);
      expect(orders.every((o) => o.customer_id === recent.customer_id)).toBe(true);
      expect(orders.some((o) => o.id === recent.id)).toBe(true);
    },
    15000,
  );

  it(
    "searchCustomers finds a real customer by email even under a non-default WordPress role " +
      "(role=all works around WooCommerce's role=customer default, which silently excludes them)",
    async () => {
      const client = new OrdersClient({ consumerKey, consumerSecret });
      const recent = await findRecentOrderWithCustomer();
      const email = recent.billing.email;
      expect(email).toBeTruthy();

      const customers = await client.searchCustomers(email!);
      expect(customers.some((c) => c.id === recent.customer_id)).toBe(true);
    },
    15000,
  );

  it(
    "rejects with a 401-flavored error when given a bad credential pair",
    async () => {
      const badClient = new OrdersClient({ consumerKey: "ck_invalid", consumerSecret: "cs_invalid" });
      await expect(badClient.searchCustomers("test")).rejects.toMatchObject({ status: 401 });
    },
    15000,
  );
});
