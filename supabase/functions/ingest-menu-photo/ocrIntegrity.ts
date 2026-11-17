/** Conservative OCR parsing: uncertain identity/price stays a separate review draft. */
export interface ExtractionDish {
  name: string;
  price: number | null;
  modifiers: string[];
  extraction_confidence: number;
}

export function normalizeName(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

export function toPriceCents(value: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  const cents = Math.round(value * 100);
  return Number.isSafeInteger(cents) && cents <= 2147483647 ? cents : null;
}

export function clampConfidence(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

export function fallbackExtract(text: string): ExtractionDish[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 3)
    .slice(0, 25)
    .flatMap((line) => {
      // Multiple prices and ranges are ambiguous; retain them for review without a price.
      const currency = [...line.matchAll(/(?:S\$|SGD\s*\$?|\$)\s*(\d+(?:\.\d{1,2})?)(?![\d.])/gi)];
      const range = /\d\s*[-–—/]\s*(?:S?\$|SGD\s*)?\s*\d/.test(line);
      const trailing = line.match(/\s+(\d+(?:\.\d{1,2})?)\s*$/);
      const token = !range && currency.length <= 1 ? (currency[0] ?? trailing) : null;
      const value = token ? Number(token[1]) : null;
      const price = toPriceCents(value) === null ? null : value;
      let name = line;
      if (token && price !== null && token.index !== undefined) {
        name = line.slice(0, token.index) + line.slice(token.index + token[0].length);
      }
      name = name
        .replace(/^\d+[.)]\s+/, "")
        .replace(/[.]{2,}/g, " ")
        .trim();
      return name.length < 2
        ? []
        : [{ name, price, modifiers: [], extraction_confidence: price !== null ? 0.72 : 0.56 }];
    });
}

export function visionText(payload: Record<string, unknown>): string {
  if (!Array.isArray(payload.responses) || !payload.responses[0]) {
    throw new Error("vision_invalid_response");
  }
  const first = payload.responses[0] as Record<string, unknown>;
  const full = (first.fullTextAnnotation as Record<string, unknown> | undefined)?.text;
  const annotation = (first.textAnnotations as Record<string, unknown>[] | undefined)?.[0]
    ?.description;
  const text = [full, annotation].find(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
  if (typeof text === "string") return text;
  if (first.error) throw new Error("vision_image_error");
  return "";
}

export function persistenceItems(extracted: ExtractionDish[]) {
  return extracted
    .filter((dish) => normalizeName(dish.name).length > 0)
    .map((dish) => ({
      name: dish.name.trim(),
      price_cents: toPriceCents(dish.price),
      modifiers: dish.modifiers,
      extraction_confidence: clampConfidence(dish.extraction_confidence),
    }));
}
