# kvartirabooks-mcp

An MCP server for [kvartirabooks.org](https://kvartirabooks.org/), a Russian
children's bookstore/library, covering its book catalog (WooCommerce Store
API), its events calendar (Eventin plugin's public REST endpoints), and
customer order/lending history (authenticated WooCommerce REST API v3).

## Tools

### Books

Kvartirabooks sells some books and lends others out like a library. The same
title can exist as two separate products: a purchasable copy (SKU is the
plain ISBN, e.g. `9785041817558`) and a borrowable library copy (SKU has an
`-L` suffix, e.g. `9785041817558-L`). Both tools surface this as an
`availability` field: `"for_sale"`, `"for_borrow"`, or `"unknown"`.

#### `search_books`

Search the catalog by title, author, or ISBN/SKU.

| param | type | default | notes |
|---|---|---|---|
| `query` | string | — | required |
| `page` | number | `1` | 1-based |
| `perPage` | number | `10` | max `100` |
| `availability` | `"any" \| "for_sale" \| "for_borrow"` | `"any"` | filters the returned page only; does not affect `total`/`totalPages` |

#### `get_book`

Fetch full details for one book by numeric product `id` or exact `sku`
(provide exactly one).

### Events

Backed by two public but incomplete REST surfaces that this server merges:
`eep/v1/events` has date/time/venue/price but only lists **upcoming** events
and has no lookup-by-ID; `wp/v2/etn/{id}` has the full description for any
event but no schedule data. `get_event` merges them; `search_events` uses
`eep/v1/events` directly.

#### `search_events`

Search upcoming events by title/description text and/or category.

| param | type | default | notes |
|---|---|---|---|
| `query` | string | — | optional; omit to browse a category |
| `category` | one of the 4 fixed category slugs | — | optional |
| `page` | number | `1` | 1-based |
| `perPage` | number | `10` | max `100` |

#### `get_event`

Fetch full details for one event by numeric `id`. Includes a `schedule`
(date/time/venue/prices) when the event is still upcoming; `schedule` is
`null` for events that have already happened, since kvartirabooks.org only
publishes schedule data for upcoming events.

### Customer orders

Backed by the **authenticated** `wc/v3` WooCommerce REST API (Consumer
Key/Secret — see Credentials below), unlike the other tools which need no
auth. Returns customer PII (name, email, phone, shipping address), so this
is for internal/store-owner use.

This store's library lending is implemented as regular WooCommerce orders
with custom statuses layered on top of the standard ones: `knigi-podobrany`
(books selected), `books-on-hand` (currently checked out), `return-initiated`,
`returned`, and `shipment-lost`. A borrowed copy's line item resolves the
same `-L`-suffix `availability` convention as the books tools.

#### `search_customers`

Look up a customer by exact email or fuzzy name match, returning their
numeric ID for use with `get_customer` and `get_customer_orders`.

| param | type | notes |
|---|---|---|
| `query` | string | email or name; required |

Always queries with `role=all` — WooCommerce's REST API defaults to
`role=customer`, which silently excludes real, paying customers registered
under a different WordPress role (this store has some under a custom
`volshebniki` role).

#### `get_customer`

Fetch a customer's profile by numeric `customerId`: current billing/shipping
address on file, `isPayingCustomer`, and account signup date. For their
purchase/lending history, use `get_customer_orders` instead.

#### `get_customer_orders`

Fetch a customer's order/lending history by numeric `customerId`, with each
line item's SKU-derived `availability`.

| param | type | default | notes |
|---|---|---|---|
| `customerId` | number | — | required, from `search_customers` |
| `status` | one of the order-status enum, incl. the custom lending statuses above | — | optional |
| `page` | number | `1` | 1-based |
| `perPage` | number | `10` | max `100` |

## Setup

```bash
npm install
npm run build
```

### Credentials (for the customer-orders tools only)

`search_customers`/`get_customer_orders` need a WooCommerce REST API key:
WP Admin -> **WooCommerce -> Settings -> Advanced -> REST API -> Add key**,
**Read** permission is enough. Then set:

```bash
cp .env.example .env
# fill in WC_CONSUMER_KEY / WC_CONSUMER_SECRET in .env (gitignored)
```

The books and events tools need no credentials — they use kvartirabooks.org's
public REST endpoints.

## Run locally

```bash
npm start
```

This starts the server on stdio, per the MCP spec — it's meant to be launched
by an MCP client (Claude Desktop, Claude Code, etc.), not run interactively.
To wire it into Claude Code, add it as an MCP server pointing at
`node dist/index.js` with this directory as `cwd`, and (if you want the
customer-orders tools) `WC_CONSUMER_KEY`/`WC_CONSUMER_SECRET` in its `env`.

For local iteration without building first:

```bash
npm run dev
```

## Tests

```bash
npm test
```

Includes unit tests (mocked HTTP) covering the sale/borrow SKU logic,
book/event/order response mapping, and the events schedule-matching logic,
plus integration tests that call the live kvartirabooks.org API (skipped
automatically if the site is unreachable, or — for the orders suite — if
`WC_CONSUMER_KEY`/`WC_CONSUMER_SECRET` aren't set; `npm test` picks up a
local `.env` automatically).
