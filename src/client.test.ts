import { describe, expect, it, vi } from "vitest";
import {
  KvartiraBooksApiError,
  KvartiraBooksClient,
  deriveAvailability,
  toBookDetail,
  toBookSummary,
  toSearchResult,
} from "./client.js";
import { forBorrowProduct, forSaleProduct } from "./__fixtures__/products.js";

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

describe("deriveAvailability", () => {
  it("marks a plain-SKU product as for_sale", () => {
    expect(deriveAvailability(forSaleProduct)).toBe("for_sale");
  });

  it("marks a -L SKU product as for_borrow", () => {
    expect(deriveAvailability(forBorrowProduct)).toBe("for_borrow");
  });

  it("falls back to the SKU suffix when tags are missing", () => {
    const untagged = { ...forBorrowProduct, tags: [] };
    expect(deriveAvailability(untagged)).toBe("for_borrow");
  });

  it("falls back to is_purchasable when tags and SKU suffix are inconclusive", () => {
    const untagged = { ...forSaleProduct, tags: [] };
    expect(deriveAvailability(untagged)).toBe("for_sale");
  });
});

describe("toBookSummary", () => {
  it("converts price from minor units and marks purchasable copies", () => {
    const summary = toBookSummary(forSaleProduct);
    expect(summary).toMatchObject({
      id: 88749,
      sku: "9785041817558",
      title: "Мы (ил. А. Симанчука)",
      authors: ["Евгений Замятин"],
      availability: "for_sale",
      isPurchasable: true,
      price: 25,
      currency: "USD",
    });
  });

  it("reports null price and currency for non-purchasable borrow copies", () => {
    const summary = toBookSummary(forBorrowProduct);
    expect(summary).toMatchObject({
      id: 88754,
      sku: "9785041817558-L",
      availability: "for_borrow",
      isPurchasable: false,
      price: null,
      currency: null,
    });
  });
});

describe("toBookDetail", () => {
  it("includes extended metadata and strips HTML from the description", () => {
    const detail = toBookDetail(forSaleProduct);
    expect(detail.publisher).toBe("Эксмо");
    expect(detail.yearPublished).toBe("2026");
    expect(detail.descriptionHtml).toBe("Some description.");
    expect(detail.tags).toContain("books-for-sale");
  });
});

describe("toSearchResult", () => {
  it("maps a page of products alongside pagination metadata", () => {
    const result = toSearchResult("9785041817558", 1, 10, {
      products: [forBorrowProduct, forSaleProduct],
      total: 2,
      totalPages: 1,
    });
    expect(result.total).toBe(2);
    expect(result.books).toHaveLength(2);
    expect(result.books.map((b) => b.availability)).toEqual(["for_borrow", "for_sale"]);
  });
});

describe("KvartiraBooksClient", () => {
  it("searchProducts reads pagination headers and passes query params", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([forSaleProduct], { headers: { "x-wp-total": "1", "x-wp-totalpages": "1" } }),
    );
    const client = new KvartiraBooksClient({ fetchImpl });

    const result = await client.searchProducts({ query: "город", page: 2, perPage: 5 });

    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.products).toEqual([forSaleProduct]);

    const calledUrl = new URL(fetchImpl.mock.calls[0][0] as string);
    expect(calledUrl.pathname).toBe("/wp-json/wc/store/v1/products");
    expect(calledUrl.searchParams.get("search")).toBe("город");
    expect(calledUrl.searchParams.get("page")).toBe("2");
    expect(calledUrl.searchParams.get("per_page")).toBe("5");
  });

  it("searchProducts throws KvartiraBooksApiError on a non-OK response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 500, statusText: "Server Error" }));
    const client = new KvartiraBooksClient({ fetchImpl });

    await expect(client.searchProducts({ query: "x" })).rejects.toBeInstanceOf(KvartiraBooksApiError);
  });

  it("getProductById returns null on 404", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    const client = new KvartiraBooksClient({ fetchImpl });

    const product = await client.getProductById(1);
    expect(product).toBeNull();
  });

  it("getProductById returns the parsed product on success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(forSaleProduct));
    const client = new KvartiraBooksClient({ fetchImpl });

    const product = await client.getProductById(88749);
    expect(product?.sku).toBe("9785041817558");
    const calledUrl = fetchImpl.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/products/88749");
  });

  it("getProductBySku passes the sku as a query param and returns the first match", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([forBorrowProduct]));
    const client = new KvartiraBooksClient({ fetchImpl });

    const product = await client.getProductBySku("9785041817558-L");
    expect(product?.id).toBe(88754);
    const calledUrl = new URL(fetchImpl.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("sku")).toBe("9785041817558-L");
  });

  it("getProductBySku returns null when no product matches", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([]));
    const client = new KvartiraBooksClient({ fetchImpl });

    const product = await client.getProductBySku("does-not-exist");
    expect(product).toBeNull();
  });
});
