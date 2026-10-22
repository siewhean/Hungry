/** Whole-input SGD validation; empty and malformed amounts are never coerced to free. */
export function parseMerchantPrice(value: string): number {
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Enter a valid SGD price, with up to two decimal places.");
  }
  const price = Number(normalized);
  if (!Number.isFinite(price)) throw new Error("Enter a valid SGD price.");
  return price;
}

export function updateMerchantAvailability(
  original: readonly string[],
  available: boolean,
  featured: boolean,
): string[] {
  return [
    ...original.filter(
      (flag) => !["sold_out", "featured"].includes(flag.toLowerCase().replace(/[\s-]+/g, "_")),
    ),
    ...(!available ? ["sold_out"] : []),
    ...(featured ? ["featured"] : []),
  ];
}

export function singaporeCalendarDate(iso: string | number | Date): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function singaporeDateBoundary(date: string, boundary: "start" | "end"): string {
  return `${date}T${boundary === "start" ? "00:00:00" : "23:59:59"}+08:00`;
}

/** Batch failures are retained, not swallowed and subsequently announced as success. */
export async function runMerchantBatch<T>(
  items: readonly T[],
  run: (item: T) => Promise<unknown>,
  shouldContinue: () => boolean = () => true,
) {
  const succeeded: T[] = [];
  const failed: T[] = [];
  for (const [index, item] of items.entries()) {
    if (!shouldContinue()) {
      failed.push(...items.slice(index));
      break;
    }
    try {
      await run(item);
      succeeded.push(item);
    } catch {
      failed.push(item);
    }
  }
  return { succeeded, failed };
}
