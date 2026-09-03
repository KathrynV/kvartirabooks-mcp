# kvartirabooks-mcp

An MCP server for [kvartirabooks.org](https://kvartirabooks.org/), a Russian
children's bookstore/library, covering both its book catalog (WooCommerce
Store API) and its events calendar (Eventin plugin's public REST endpoints).

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

## Setup

```bash
npm install
npm run build
```

## Run locally

```bash
npm start
```

This starts the server on stdio, per the MCP spec — it's meant to be launched
by an MCP client (Claude Desktop, Claude Code, etc.), not run interactively.
To wire it into Claude Code, add it as an MCP server pointing at
`node dist/index.js` with this directory as `cwd`.

For local iteration without building first:

```bash
npm run dev
```

## Tests

```bash
npm test
```

Includes unit tests (mocked HTTP) covering the sale/borrow SKU logic,
book/event response mapping, and the events schedule-matching logic, plus
integration tests that call the live kvartirabooks.org API (skipped
automatically if the site is unreachable).
