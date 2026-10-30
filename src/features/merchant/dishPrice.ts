export const MAX_DISH_PRICE = 9999;

/** A typed price ("5.50", "S$5.5") as a number, or null when it is not a valid dish price. */
export function parseDishPrice(value: string): number | null {
  const trimmed = value.trim().replace(/^S?\$/i, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const price = Number(trimmed);
  return price > 0 && price <= MAX_DISH_PRICE ? price : null;
}

export function formatDishPrice(price: number): string {
  return `S$${price.toFixed(2)}`;
}
