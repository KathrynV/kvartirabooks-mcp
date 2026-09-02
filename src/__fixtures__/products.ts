import type { WcStoreProduct } from "../types.js";

// Trimmed, representative fixtures mirroring the real WooCommerce Store API
// responses for https://kvartirabooks.org/wp-json/wc/store/v1/products/88754
// and its library counterpart (search=9785041817558).

export const forSaleProduct: WcStoreProduct = {
  id: 88749,
  name: "Мы (ил. А. Симанчука)", // "Мы (ил. А. Симанчука)"
  slug: "my-il-a-simanchuka",
  sku: "9785041817558",
  permalink: "https://kvartirabooks.org/product/my-il-a-simanchuka/",
  description: "<p>Some description.</p>",
  short_description: "",
  on_sale: false,
  prices: {
    price: "2500",
    regular_price: "2500",
    sale_price: "2500",
    currency_code: "USD",
    currency_symbol: "$",
    currency_minor_unit: 2,
  },
  images: [
    { id: 1, src: "https://kvartirabooks.org/wp-content/uploads/my.jpg", thumbnail: "", name: "my", alt: "" },
  ],
  categories: [
    { id: 22, name: "Store", slug: "store-cat" },
    { id: 21, name: "Книги", slug: "books" },
  ],
  tags: [
    { id: 1633, name: "books-for-sale", slug: "books-for-sale" },
    { id: 5803, name: "russian", slug: "russian" },
  ],
  attributes: [
    { id: 3, name: "Author(s):", taxonomy: "pa_writer", terms: [{ id: 1, name: "Евгений Замятин", slug: "evgenij-zamyatin" }] },
    { id: 6, name: "Publisher:", taxonomy: "pa_publisher", terms: [{ id: 2, name: "Эксмо", slug: "eksmo" }] },
    { id: 9, name: "Year published:", taxonomy: "pa_publication-year", terms: [{ id: 3, name: "2026", slug: "2026" }] },
  ],
  is_purchasable: true,
  is_in_stock: true,
  stock_availability: { text: "In stock", class: "in-stock" },
};

export const forBorrowProduct: WcStoreProduct = {
  ...forSaleProduct,
  id: 88754,
  slug: "my-il-a-simanchuka-copy",
  sku: "9785041817558-L",
  permalink: "https://kvartirabooks.org/product/my-il-a-simanchuka-copy/",
  on_sale: false,
  prices: {
    price: "0",
    regular_price: "0",
    sale_price: "0",
    currency_code: "USD",
    currency_symbol: "$",
    currency_minor_unit: 2,
  },
  categories: [
    { id: 3291, name: "Библиотека", slug: "library" },
    { id: 21, name: "Книги", slug: "books" },
  ],
  tags: [
    { id: 68, name: "library", slug: "library" },
    { id: 5803, name: "russian", slug: "russian" },
  ],
  is_purchasable: false,
};
