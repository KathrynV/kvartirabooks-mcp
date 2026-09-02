import type {
  Availability,
  BookDetail,
  BookSummary,
  SearchResult,
  WcStoreProduct,
} from "./types.js";

const DEFAULT_BASE_URL = "https://kvartirabooks.org/wp-json/wc/store/v1";

export class KvartiraBooksApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "KvartiraBooksApiError";
  }
}

export interface KvartiraBooksClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class KvartiraBooksClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: KvartiraBooksClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async searchProducts(params: {
    query: string;
    page?: number;
    perPage?: number;
  }): Promise<{ products: WcStoreProduct[]; total: number; totalPages: number }> {
    const url = new URL(`${this.baseUrl}/products`);
    url.searchParams.set("search", params.query);
    url.searchParams.set("page", String(params.page ?? 1));
    url.searchParams.set("per_page", String(params.perPage ?? 10));

    const res = await this.fetchImpl(url.toString());
    if (!res.ok) {
      throw new KvartiraBooksApiError(
        `Search request failed: ${res.status} ${res.statusText}`,
        res.status,
      );
    }
    const products = (await res.json()) as WcStoreProduct[];
    const total = Number(res.headers.get("x-wp-total") ?? products.length);
    const totalPages = Number(res.headers.get("x-wp-totalpages") ?? 1);
    return { products, total, totalPages };
  }

  async getProductById(id: number): Promise<WcStoreProduct | null> {
    const url = `${this.baseUrl}/products/${id}`;
    const res = await this.fetchImpl(url);
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      throw new KvartiraBooksApiError(
        `Get product request failed: ${res.status} ${res.statusText}`,
        res.status,
      );
    }
    return (await res.json()) as WcStoreProduct;
  }

  async getProductBySku(sku: string): Promise<WcStoreProduct | null> {
    const url = new URL(`${this.baseUrl}/products`);
    url.searchParams.set("sku", sku);
    const res = await this.fetchImpl(url.toString());
    if (!res.ok) {
      throw new KvartiraBooksApiError(
        `Get product by SKU request failed: ${res.status} ${res.statusText}`,
        res.status,
      );
    }
    const products = (await res.json()) as WcStoreProduct[];
    return products[0] ?? null;
  }
}

export function deriveAvailability(product: WcStoreProduct): Availability {
  const tagSlugs = product.tags.map((t) => t.slug);
  if (tagSlugs.includes("library")) return "for_borrow";
  if (tagSlugs.includes("books-for-sale")) return "for_sale";
  // Fall back to the SKU convention (borrow copies are suffixed "-L") and
  // purchasability if tags are ever missing.
  if (product.sku.endsWith("-L")) return "for_borrow";
  if (product.is_purchasable) return "for_sale";
  return "unknown";
}

function findAttribute(product: WcStoreProduct, taxonomy: string): string[] {
  const attr = product.attributes.find((a) => a.taxonomy === taxonomy);
  return attr ? attr.terms.map((t) => t.name) : [];
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&nbsp;/g, " ");
}

export function toBookSummary(product: WcStoreProduct): BookSummary {
  const price = Number(product.prices.price);
  return {
    id: product.id,
    sku: product.sku,
    title: decodeHtmlEntities(product.name),
    authors: findAttribute(product, "pa_writer"),
    availability: deriveAvailability(product),
    isPurchasable: product.is_purchasable,
    inStock: product.is_in_stock,
    price: product.is_purchasable && price > 0 ? price / 100 : null,
    currency: product.is_purchasable ? product.prices.currency_code : null,
    permalink: product.permalink,
    coverImage: product.images[0]?.src ?? null,
  };
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")).trim();
}

export function toBookDetail(product: WcStoreProduct): BookDetail {
  return {
    ...toBookSummary(product),
    illustrators: findAttribute(product, "pa_illustrator"),
    publisher: findAttribute(product, "pa_publisher")[0] ?? null,
    yearPublished: findAttribute(product, "pa_publication-year")[0] ?? null,
    ageGroup: findAttribute(product, "pa_listener-age")[0] ?? null,
    cover: findAttribute(product, "pa_cover")[0] ?? null,
    section: findAttribute(product, "pa_otdel")[0] ?? null,
    descriptionHtml: stripHtml(product.description),
    categories: product.categories.map((c) => c.name),
    tags: product.tags.map((t) => t.slug),
    images: product.images.map((img) => img.src),
  };
}

export function toSearchResult(
  query: string,
  page: number,
  perPage: number,
  data: { products: WcStoreProduct[]; total: number; totalPages: number },
): SearchResult {
  return {
    query,
    page,
    perPage,
    total: data.total,
    totalPages: data.totalPages,
    books: data.products.map(toBookSummary),
  };
}
