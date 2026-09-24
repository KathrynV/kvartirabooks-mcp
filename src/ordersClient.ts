import type {
  CustomerDetail,
  CustomerOrdersResult,
  CustomerSummary,
  OrderLineItem,
  OrderSummary,
  PostalAddress,
  SearchCustomersResult,
  WcAddress,
  WcCustomer,
  WcLineItem,
  WcOrder,
} from "./orderTypes.js";
import { KvartiraBooksApiError } from "./errors.js";
import { deriveAvailabilityFromSku } from "./availability.js";
import { USER_AGENT } from "./userAgent.js";

const DEFAULT_BASE_URL = "https://kvartirabooks.org/wp-json/wc/v3";

// Confirmed live via an unauthenticated OPTIONS request against
// /wc/v3/orders, which returns the endpoint's argument schema without
// needing credentials. Includes this store's custom lending-workflow
// statuses alongside the WooCommerce defaults.
export const ORDER_STATUSES = [
  "any",
  "pending",
  "processing",
  "on-hold",
  "completed",
  "cancelled",
  "refunded",
  "failed",
  "checkout-draft",
  "knigi-podobrany",
  "books-on-hand",
  "return-initiated",
  "returned",
  "shipment-lost",
  "gift-cert-order-c",
] as const;

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export interface OrdersClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  consumerKey?: string;
  consumerSecret?: string;
}

export class OrdersClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly consumerKey?: string;
  private readonly consumerSecret?: string;

  constructor(options: OrdersClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.consumerKey = options.consumerKey;
    this.consumerSecret = options.consumerSecret;
  }

  private authHeaders(): Record<string, string> {
    if (!this.consumerKey || !this.consumerSecret) {
      throw new KvartiraBooksApiError(
        "Missing WooCommerce API credentials. Set the WC_CONSUMER_KEY and " +
          "WC_CONSUMER_SECRET environment variables (WooCommerce Admin -> " +
          "Settings -> Advanced -> REST API -> Add key, Read permission).",
      );
    }
    const token = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString("base64");
    return { Authorization: `Basic ${token}`, "User-Agent": USER_AGENT };
  }

  // GET /wc/v3/customers?search=... or ?email=...
  async searchCustomers(query: string): Promise<WcCustomer[]> {
    const url = new URL(`${this.baseUrl}/customers`);
    if (EMAIL_PATTERN.test(query)) {
      url.searchParams.set("email", query);
    } else {
      url.searchParams.set("search", query);
    }
    // WooCommerce defaults this endpoint to role=customer, which silently
    // excludes real, paying customers registered under a different
    // WordPress role (confirmed live: this store has accounts under a
    // custom "volshebniki" role with full order histories that the
    // default role filter hides entirely).
    url.searchParams.set("role", "all");
    url.searchParams.set("per_page", "10");

    const res = await this.fetchImpl(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) {
      throw new KvartiraBooksApiError(
        `Customer search request failed: ${res.status} ${res.statusText}`,
        res.status,
      );
    }
    return (await res.json()) as WcCustomer[];
  }

  // GET /wc/v3/customers/{id}
  async getCustomerById(id: number): Promise<WcCustomer | null> {
    const url = `${this.baseUrl}/customers/${id}`;
    const res = await this.fetchImpl(url, { headers: this.authHeaders() });
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      throw new KvartiraBooksApiError(
        `Get customer request failed: ${res.status} ${res.statusText}`,
        res.status,
      );
    }
    return (await res.json()) as WcCustomer;
  }

  // GET /wc/v3/orders?customer=...&status=...
  async getCustomerOrders(
    customerId: number,
    params: { status?: string; page?: number; perPage?: number } = {},
  ): Promise<{ orders: WcOrder[]; total: number; totalPages: number }> {
    const url = new URL(`${this.baseUrl}/orders`);
    url.searchParams.set("customer", String(customerId));
    if (params.status && params.status !== "any") {
      url.searchParams.set("status", params.status);
    }
    url.searchParams.set("page", String(params.page ?? 1));
    url.searchParams.set("per_page", String(params.perPage ?? 10));
    url.searchParams.set("orderby", "date");
    url.searchParams.set("order", "desc");

    const res = await this.fetchImpl(url.toString(), { headers: this.authHeaders() });
    if (!res.ok) {
      throw new KvartiraBooksApiError(
        `Get customer orders request failed: ${res.status} ${res.statusText}`,
        res.status,
      );
    }
    const orders = (await res.json()) as WcOrder[];
    const total = Number(res.headers.get("x-wp-total") ?? orders.length);
    const totalPages = Number(res.headers.get("x-wp-totalpages") ?? 1);
    return { orders, total, totalPages };
  }
}

function toCustomerSummary(customer: WcCustomer): CustomerSummary {
  return {
    id: customer.id,
    name: `${customer.first_name} ${customer.last_name}`.trim(),
    email: customer.email,
    phone: customer.billing?.phone || null,
  };
}

export function toSearchCustomersResult(query: string, customers: WcCustomer[]): SearchCustomersResult {
  return {
    query,
    customers: customers.map(toCustomerSummary),
  };
}

export function toCustomerDetail(customer: WcCustomer): CustomerDetail {
  return {
    ...toCustomerSummary(customer),
    isPayingCustomer: customer.is_paying_customer,
    dateCreated: customer.date_created,
    billingAddress: toPostalAddress(customer.billing),
    shippingAddress: toPostalAddress(customer.shipping),
  };
}

function toOrderLineItem(item: WcLineItem): OrderLineItem {
  return {
    productId: item.product_id,
    sku: item.sku,
    name: item.name,
    quantity: item.quantity,
    total: Number(item.total),
    availability: deriveAvailabilityFromSku(item.sku),
  };
}

function toPostalAddress(addr: WcAddress): PostalAddress {
  return {
    name: `${addr.first_name} ${addr.last_name}`.trim(),
    address1: addr.address_1,
    address2: addr.address_2,
    city: addr.city,
    state: addr.state,
    postcode: addr.postcode,
    country: addr.country,
  };
}

function toShippingAddress(order: WcOrder): PostalAddress {
  return toPostalAddress(order.shipping.address_1 ? order.shipping : order.billing);
}

function toOrderSummary(order: WcOrder): OrderSummary {
  return {
    id: order.id,
    status: order.status,
    dateCreated: order.date_created,
    total: Number(order.total),
    currency: order.currency,
    lineItems: order.line_items.map(toOrderLineItem),
    shippingAddress: toShippingAddress(order),
    customerNote: order.customer_note,
  };
}

export function toCustomerOrdersResult(
  customerId: number,
  status: string | null,
  page: number,
  perPage: number,
  data: { orders: WcOrder[]; total: number; totalPages: number },
): CustomerOrdersResult {
  return {
    customerId,
    status,
    page,
    perPage,
    total: data.total,
    totalPages: data.totalPages,
    orders: data.orders.map(toOrderSummary),
  };
}
