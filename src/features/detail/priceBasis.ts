import type { DishDetail, HalalStatus, PriceBasis } from "@/types/domain";

import { formatDishPrice } from "./dishPrice";

const PRICE_BASES: readonly PriceBasis[] = ["counter", "menu", "delivery"];
const HALAL_STATUSES: readonly HalalStatus[] = ["yes", "no", "unknown"];

/** Reads the RPC's price_basis; anything else (null, an old client field) is "unknown". */
export function toPriceBasis(value: unknown): PriceBasis | undefined {
  return PRICE_BASES.includes(value as PriceBasis) ? (value as PriceBasis) : undefined;
}

/** Reads the RPC's halal_status; missing means "unknown", never "no". */
export function toHalalStatus(value: unknown): HalalStatus | undefined {
  return HALAL_STATUSES.includes(value as HalalStatus) ? (value as HalalStatus) : undefined;
}

/**
 * The price as diners should read it. A delivery-app price is inflated, so it reads
 * "~S$6.80" (cards) or "about S$6.80" (dish page) and is marked estimated.
 */
export function formatPriceWithBasis(
  dish: Pick<DishDetail, "price" | "priceRange" | "priceBasis">,
  form: "short" | "long" = "short",
): { text: string; estimated: boolean; listed: boolean } {
  const text = formatDishPrice(dish);
  const listed = text !== "Price not listed";
  const estimated = listed && dish.priceBasis === "delivery";
  if (!estimated) return { text, estimated, listed };
  return { text: form === "long" ? `about ${text}` : `~${text}`, estimated, listed };
}

export interface PriceBasisCopy {
  /** Card / menu tag: "Counter", "Menu", "Delivery". */
  short: string;
  /** Dish page tag: "Counter price", "Menu price", "Delivery app price". */
  long: string;
  /** Spoken label, e.g. "Counter price, seen at the stall". */
  accessibilityLabel: string;
}

const COPY: Record<PriceBasis, PriceBasisCopy> = {
  counter: {
    short: "Counter",
    long: "Counter price",
    accessibilityLabel: "Counter price, seen at the stall",
  },
  menu: {
    short: "Menu",
    long: "Menu price",
    accessibilityLabel: "Menu price, from the stall's own menu",
  },
  delivery: {
    short: "Delivery",
    long: "Delivery app price",
    accessibilityLabel: "Delivery app price, usually higher than at the counter",
  },
};

export function priceBasisCopy(basis: PriceBasis): PriceBasisCopy {
  return COPY[basis];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "12 Nov 2026" in Singapore time; undefined for a missing or bad date. */
export function formatCheckedDate(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return undefined;
  const sg = new Date(ms + 8 * 60 * 60 * 1000);
  return `${sg.getUTCDate()} ${MONTHS[sg.getUTCMonth()]} ${sg.getUTCFullYear()}`;
}

/** Dish page explanation under the price tag: what the label means and when it was checked. */
export function priceBasisDetail(
  dish: Pick<DishDetail, "priceBasis" | "priceCheckedAt">,
): { title: string; body: string } | undefined {
  if (!dish.priceBasis) return undefined;
  const date = formatCheckedDate(dish.priceCheckedAt);
  switch (dish.priceBasis) {
    case "counter":
      return {
        title: date ? `Counter price, checked ${date}.` : "Counter price.",
        body: "This is what you pay at the stall.",
      };
    case "menu":
      return {
        title: date ? `From the stall's menu, seen ${date}.` : "From the stall's menu.",
        body: "The counter price may differ.",
      };
    case "delivery":
      return {
        title: date ? `From a delivery app, seen ${date}.` : "From a delivery app.",
        body: "Delivery prices are usually higher, so expect to pay less at the counter.",
      };
  }
}

/** Dish page halal line. Unknown is said plainly so it never reads as "not halal". */
export function halalStatusCopy(status: HalalStatus): {
  tag: string;
  title: string;
  body: string;
} {
  switch (status) {
    case "yes":
      return {
        tag: "Halal",
        title: "Halal",
        body: "From the stall or our catalogue. Look for the MUIS certificate at the stall.",
      };
    case "no":
      return { tag: "Not halal", title: "Not halal", body: "From the stall or our catalogue." };
    case "unknown":
      return {
        tag: "Halal not confirmed",
        title: "We don't know yet if this is halal.",
        body: "Ask the stall before you order.",
      };
  }
}
