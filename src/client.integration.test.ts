// Integration tests against the real kvartirabooks.org Store API.
// These hit the network and will be skipped automatically if the site is
// unreachable, but otherwise run as part of `npm test`.

import { describe, expect, it } from "vitest";
import { KvartiraBooksClient, toBookDetail, toBookSummary } from "./client.js";

const client = new KvartiraBooksClient();

async function isSiteReachable(): Promise<boolean> {
  try {
    const res = await fetch("https://kvartirabooks.org/wp-json/wc/store/v1/products/88754");
    return res.ok;
  } catch {
    return false;
  }
}

// Top-level await: skip the whole suite up front if the live site can't be reached.
const siteReachable = await isSiteReachable();

describe.skipIf(!siteReachable)("kvartirabooks.org live API", () => {
  it(
    "fetches the example product by ID (borrow copy)",
    async () => {
      const product = await client.getProductById(88754);
      expect(product).not.toBeNull();
      expect(product!.sku).toBe("9785041817558-L");

      const detail = toBookDetail(product!);
      expect(detail.availability).toBe("for_borrow");
      expect(detail.isPurchasable).toBe(false);
    },
    15000,
  );

  it(
    "search by title returns results with derived availability",
    async () => {
      const { products } = await client.searchProducts({ query: "город", perPage: 5 });
      expect(products.length).toBeGreaterThan(0);
      const summaries = products.map(toBookSummary);
      for (const s of summaries) {
        expect(["for_sale", "for_borrow", "unknown"]).toContain(s.availability);
      }
    },
    15000,
  );

  it(
    "search by ISBN returns both a for-sale and a for-borrow copy",
    async () => {
      const { products } = await client.searchProducts({ query: "9785041817558" });
      const summaries = products.map(toBookSummary);

      const forSale = summaries.find((s) => s.sku === "9785041817558");
      const forBorrow = summaries.find((s) => s.sku === "9785041817558-L");

      expect(forSale).toBeDefined();
      expect(forSale!.availability).toBe("for_sale");
      expect(forSale!.isPurchasable).toBe(true);

      expect(forBorrow).toBeDefined();
      expect(forBorrow!.availability).toBe("for_borrow");
      expect(forBorrow!.isPurchasable).toBe(false);
    },
    15000,
  );

  it(
    "getProductBySku fetches the exact borrow copy",
    async () => {
      const product = await client.getProductBySku("9785041817558-L");
      expect(product?.id).toBe(88754);
    },
    15000,
  );
});
