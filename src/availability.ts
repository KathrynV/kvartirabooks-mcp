import type { Availability } from "./types.js";

// Borrow copies are always SKU'd with a "-L" suffix (see client.ts's
// deriveAvailability for the tag-based primary signal). Order line items
// only carry a bare SKU string, so this suffix is the only signal available
// there. Some order line items (fees, gift cards, products with no SKU set)
// have no SKU at all.
export function deriveAvailabilityFromSku(sku: string | null): Availability {
  if (!sku) return "unknown";
  return sku.endsWith("-L") ? "for_borrow" : "for_sale";
}
