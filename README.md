# kvartirabooks-mcp

An MCP server for [kvartirabooks.org](https://kvartirabooks.org/), a Russian
children's bookstore/library, backed by the site's public WooCommerce Store
API (`/wp-json/wc/store/v1`).

Kvartirabooks sells some books and lends others out like a library. The same
title can exist as two separate products: a purchasable copy (SKU is the
plain ISBN, e.g. `9785041817558`) and a borrowable library copy (SKU has an
`-L` suffix, e.g. `9785041817558-L`). Both tools surface this as an
`availability` field: `"for_sale"`, `"for_borrow"`, or `"unknown"`.

## Tools

### `search_books`

Search the catalog by title, author, or ISBN/SKU.

| param | type | default | notes |
|---|---|---|---|
| `query` | string | — | required |
| `page` | number | `1` | 1-based |
| `perPage` | number | `10` | max `100` |
| `availability` | `"any" \| "for_sale" \| "for_borrow"` | `"any"` | filters the returned page only; does not affect `total`/`totalPages` |

### `get_book`

Fetch full details for one book by numeric product `id` or exact `sku`
(provide exactly one).

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

Includes unit tests (mocked HTTP) covering the sale/borrow SKU logic and
response mapping, plus integration tests that call the live
kvartirabooks.org API (skipped automatically if the site is unreachable).
