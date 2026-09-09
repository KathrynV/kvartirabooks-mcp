// Shapes for the authenticated WooCommerce REST API v3 (/wp-json/wc/v3),
// used for customer and order lookups. Unlike the public catalog/events
// APIs, this requires a Consumer Key/Secret (see ordersClient.ts) and
// returns customer PII.

import type { Availability } from "./types.js";

export interface WcAddress {
  first_name: string;
  last_name: string;
  company: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  email?: string;
  phone?: string;
}

export interface WcLineItem {
  id: number;
  name: string;
  product_id: number;
  quantity: number;
  sku: string | null;
  total: string;
}

export interface WcOrder {
  id: number;
  number: string;
  status: string;
  currency: string;
  date_created: string;
  total: string;
  customer_id: number;
  billing: WcAddress;
  shipping: WcAddress;
  customer_note: string;
  line_items: WcLineItem[];
}

export interface WcCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  billing: WcAddress;
}

// Simplified shapes returned by this MCP server's tools.

export interface CustomerSummary {
  id: number;
  name: string;
  email: string;
  phone: string | null;
}

export interface OrderLineItem {
  productId: number;
  sku: string | null;
  name: string;
  quantity: number;
  total: number;
  availability: Availability;
}

export interface OrderShippingAddress {
  name: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}

export interface OrderSummary {
  id: number;
  status: string;
  dateCreated: string;
  total: number;
  currency: string;
  lineItems: OrderLineItem[];
  shippingAddress: OrderShippingAddress;
  customerNote: string;
}

export interface CustomerOrdersResult {
  customerId: number;
  status: string | null;
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  orders: OrderSummary[];
}

export interface SearchCustomersResult {
  query: string;
  customers: CustomerSummary[];
}
