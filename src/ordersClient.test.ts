import { describe, expect, it, vi } from "vitest";
import { OrdersClient, toCustomerDetail, toCustomerOrdersResult, toSearchCustomersResult } from "./ordersClient.js";
import { KvartiraBooksApiError } from "./errors.js";
import { borrowOrder, customer, purchaseOrder } from "./__fixtures__/orders.js";

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

describe("toSearchCustomersResult", () => {
  it("maps name and phone from the customer record", () => {
    const result = toSearchCustomersResult("jane", [customer]);
    expect(result.customers).toEqual([
      { id: 4821, name: "Jane Doe", email: "jane.doe@example.com", phone: "5551234567" },
    ]);
  });
});

describe("toCustomerDetail", () => {
  it("maps profile fields alongside billing and shipping addresses", () => {
    const detail = toCustomerDetail(customer);
    expect(detail).toMatchObject({
      id: 4821,
      name: "Jane Doe",
      email: "jane.doe@example.com",
      phone: "5551234567",
      isPayingCustomer: true,
      dateCreated: "2025-01-15T10:00:00",
      billingAddress: { name: "Jane Doe", address1: "123 Main St", city: "Brooklyn" },
      shippingAddress: { name: "Jane Doe", address1: "123 Main St", city: "Brooklyn" },
    });
  });
});

describe("toCustomerOrdersResult", () => {
  it("derives availability per line item from its SKU suffix", () => {
    const result = toCustomerOrdersResult(4821, null, 1, 10, {
      orders: [borrowOrder, purchaseOrder],
      total: 2,
      totalPages: 1,
    });
    expect(result.orders[0].lineItems[0]).toMatchObject({ sku: "9785041817558-L", availability: "for_borrow" });
    expect(result.orders[1].lineItems[0]).toMatchObject({ sku: "9785041817558", availability: "for_sale" });
  });

  it("converts totals to numbers and carries the status filter through", () => {
    const result = toCustomerOrdersResult(4821, "books-on-hand", 1, 10, {
      orders: [borrowOrder],
      total: 1,
      totalPages: 1,
    });
    expect(result.status).toBe("books-on-hand");
    expect(result.orders[0].total).toBe(0);
    expect(result.orders[0].status).toBe("books-on-hand");
  });

  it("marks a line item with no SKU (e.g. a fee or gift card) as unknown availability", () => {
    const orderWithNoSku = {
      ...borrowOrder,
      line_items: [{ ...borrowOrder.line_items[0], sku: null }],
    };
    const result = toCustomerOrdersResult(4821, null, 1, 10, {
      orders: [orderWithNoSku],
      total: 1,
      totalPages: 1,
    });
    expect(result.orders[0].lineItems[0]).toMatchObject({ sku: null, availability: "unknown" });
  });

  it("falls back to the billing address when shipping is empty", () => {
    const result = toCustomerOrdersResult(4821, null, 1, 10, {
      orders: [borrowOrder],
      total: 1,
      totalPages: 1,
    });
    expect(result.orders[0].shippingAddress).toMatchObject({ city: "Brooklyn", postcode: "11201" });
  });
});

describe("OrdersClient", () => {
  it("throws a clear error when credentials are missing", async () => {
    const client = new OrdersClient({ fetchImpl: vi.fn() });
    await expect(client.searchCustomers("jane")).rejects.toThrow(/WC_CONSUMER_KEY/);
  });

  it("searchCustomers uses the email param for an email-shaped query", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([customer]));
    const client = new OrdersClient({ fetchImpl, consumerKey: "ck_x", consumerSecret: "cs_x" });

    await client.searchCustomers("jane.doe@example.com");

    const calledUrl = new URL(fetchImpl.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("email")).toBe("jane.doe@example.com");
    expect(calledUrl.searchParams.has("search")).toBe(false);
  });

  it("searchCustomers uses the search param for a name query", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([customer]));
    const client = new OrdersClient({ fetchImpl, consumerKey: "ck_x", consumerSecret: "cs_x" });

    await client.searchCustomers("Jane Doe");

    const calledUrl = new URL(fetchImpl.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("search")).toBe("Jane Doe");
    expect(calledUrl.searchParams.has("email")).toBe(false);
  });

  it("searchCustomers always passes role=all so non-default-role customers aren't silently excluded", async () => {
    // WooCommerce's default role=customer filter hides real, paying
    // customers registered under a different WordPress role.
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([customer]));
    const client = new OrdersClient({ fetchImpl, consumerKey: "ck_x", consumerSecret: "cs_x" });

    await client.searchCustomers("jane.doe@example.com");

    const calledUrl = new URL(fetchImpl.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("role")).toBe("all");
  });

  it("searchCustomers sends HTTP Basic Auth built from the credentials", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([customer]));
    const client = new OrdersClient({ fetchImpl, consumerKey: "ck_x", consumerSecret: "cs_y" });

    await client.searchCustomers("jane");

    const options = fetchImpl.mock.calls[0][1] as RequestInit;
    const headers = options.headers as Record<string, string>;
    const expected = `Basic ${Buffer.from("ck_x:cs_y").toString("base64")}`;
    expect(headers.Authorization).toBe(expected);
  });

  it("searchCustomers throws KvartiraBooksApiError on a non-OK response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 401, statusText: "Unauthorized" }));
    const client = new OrdersClient({ fetchImpl, consumerKey: "ck_x", consumerSecret: "cs_x" });

    await expect(client.searchCustomers("jane")).rejects.toBeInstanceOf(KvartiraBooksApiError);
  });

  it("getCustomerById returns null on 404", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    const client = new OrdersClient({ fetchImpl, consumerKey: "ck_x", consumerSecret: "cs_x" });

    expect(await client.getCustomerById(1)).toBeNull();
  });

  it("getCustomerById requests the customer by id and sends auth", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(customer));
    const client = new OrdersClient({ fetchImpl, consumerKey: "ck_x", consumerSecret: "cs_x" });

    const result = await client.getCustomerById(4821);

    expect(result).toEqual(customer);
    const calledUrl = fetchImpl.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/customers/4821");
    const options = fetchImpl.mock.calls[0][1] as RequestInit;
    expect((options.headers as Record<string, string>).Authorization).toBeDefined();
  });

  it("getCustomerById throws KvartiraBooksApiError on a non-OK response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 500, statusText: "Server Error" }));
    const client = new OrdersClient({ fetchImpl, consumerKey: "ck_x", consumerSecret: "cs_x" });

    await expect(client.getCustomerById(4821)).rejects.toBeInstanceOf(KvartiraBooksApiError);
  });

  it("getCustomerOrders reads pagination headers and forwards customer/status/paging params", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([borrowOrder], { headers: { "x-wp-total": "1", "x-wp-totalpages": "1" } }),
    );
    const client = new OrdersClient({ fetchImpl, consumerKey: "ck_x", consumerSecret: "cs_x" });

    const result = await client.getCustomerOrders(4821, { status: "books-on-hand", page: 2, perPage: 5 });

    expect(result.total).toBe(1);
    expect(result.orders).toEqual([borrowOrder]);

    const calledUrl = new URL(fetchImpl.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("customer")).toBe("4821");
    expect(calledUrl.searchParams.get("status")).toBe("books-on-hand");
    expect(calledUrl.searchParams.get("page")).toBe("2");
    expect(calledUrl.searchParams.get("per_page")).toBe("5");
  });

  it("getCustomerOrders omits the status param for 'any'", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([]));
    const client = new OrdersClient({ fetchImpl, consumerKey: "ck_x", consumerSecret: "cs_x" });

    await client.getCustomerOrders(4821, { status: "any" });

    const calledUrl = new URL(fetchImpl.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.has("status")).toBe(false);
  });

  it("getCustomerOrders throws KvartiraBooksApiError on a non-OK response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 500, statusText: "Server Error" }));
    const client = new OrdersClient({ fetchImpl, consumerKey: "ck_x", consumerSecret: "cs_x" });

    await expect(client.getCustomerOrders(4821)).rejects.toBeInstanceOf(KvartiraBooksApiError);
  });
});
