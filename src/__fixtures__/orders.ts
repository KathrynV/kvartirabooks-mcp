import type { WcCustomer, WcOrder } from "../orderTypes.js";

// Fabricated fixtures matching the real WooCommerce v3 shape confirmed
// live (see ordersClient.integration.test.ts) — no real customer data.

export const customer: WcCustomer = {
  id: 4821,
  email: "jane.doe@example.com",
  first_name: "Jane",
  last_name: "Doe",
  billing: {
    first_name: "Jane",
    last_name: "Doe",
    company: "",
    address_1: "123 Main St",
    address_2: "",
    city: "Brooklyn",
    state: "NY",
    postcode: "11201",
    country: "US",
    email: "jane.doe@example.com",
    phone: "5551234567",
  },
};

export const borrowOrder: WcOrder = {
  id: 90236,
  number: "90236",
  status: "books-on-hand",
  currency: "USD",
  date_created: "2026-09-01T11:07:05",
  total: "0.00",
  customer_id: 4821,
  billing: customer.billing,
  shipping: { ...customer.billing, phone: undefined, email: undefined },
  customer_note: "",
  line_items: [
    {
      id: 1,
      name: "Мы (ил. А. Симанчука)",
      product_id: 88754,
      quantity: 1,
      sku: "9785041817558-L",
      total: "0.00",
    },
  ],
};

export const purchaseOrder: WcOrder = {
  ...borrowOrder,
  id: 90110,
  number: "90110",
  status: "completed",
  total: "25.00",
  line_items: [
    {
      id: 2,
      name: "Мы (ил. А. Симанчука)",
      product_id: 88749,
      quantity: 1,
      sku: "9785041817558",
      total: "25.00",
    },
  ],
};
