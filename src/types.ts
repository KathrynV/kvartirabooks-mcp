// Shape of a product as returned by the WooCommerce Store API
// (GET /wp-json/wc/store/v1/products and /products/{id}).
// Only the fields this server actually reads are declared.

export interface WcTerm {
  id: number;
  name: string;
  slug: string;
  link?: string;
}

export interface WcImage {
  id: number;
  src: string;
  thumbnail: string;
  name: string;
  alt: string;
}

export interface WcAttribute {
  id: number;
  name: string;
  taxonomy: string;
  terms: WcTerm[];
}

export interface WcPrices {
  price: string;
  regular_price: string;
  sale_price: string;
  currency_code: string;
  currency_symbol: string;
  currency_minor_unit: number;
}

export interface WcStoreProduct {
  id: number;
  name: string;
  slug: string;
  sku: string;
  permalink: string;
  description: string;
  short_description: string;
  on_sale: boolean;
  prices: WcPrices;
  images: WcImage[];
  categories: WcTerm[];
  tags: WcTerm[];
  attributes: WcAttribute[];
  is_purchasable: boolean;
  is_in_stock: boolean;
  stock_availability: { text: string; class: string };
}

export type Availability = "for_sale" | "for_borrow" | "unknown";

// Simplified shapes returned by this MCP server's tools.

export interface BookSummary {
  id: number;
  sku: string;
  title: string;
  authors: string[];
  availability: Availability;
  isPurchasable: boolean;
  inStock: boolean;
  price: number | null;
  currency: string | null;
  permalink: string;
  coverImage: string | null;
}

export interface BookDetail extends BookSummary {
  illustrators: string[];
  publisher: string | null;
  yearPublished: string | null;
  ageGroup: string | null;
  cover: string | null;
  section: string | null;
  descriptionHtml: string;
  categories: string[];
  tags: string[];
  images: string[];
}

export interface SearchResult {
  query: string;
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  books: BookSummary[];
}
