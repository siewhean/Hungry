/**
 * "Suggest a dish": the pure rules for the form. The dish goes to the team as a catalog
 * correction whose note starts "New dish:", so it is easy to tell from other reports.
 */
export type DishSuggestionDraft = { name: string; price: string; details: string };

/** submit_catalog_correction keeps at most 500 characters of the note. */
const NOTE_MAX_LENGTH = 500;
const NAME_MAX_LENGTH = 80;
const MAX_PRICE = 500;

/** "4.5", "S$4.50" or "$4" as a number; null when it is not a price. */
export function parseSuggestedPrice(raw: string): number | null {
  const cleaned = raw.trim().replace(/^s?\$\s*/i, "");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return value > 0 && value <= MAX_PRICE ? value : null;
}

/** Why the dish cannot be sent yet, or null when it can. */
export function dishSuggestionProblem(draft: DishSuggestionDraft): string | null {
  const name = draft.name.trim();
  if (name.length === 0) return "Add the dish name.";
  if (name.length < 2) return "The dish name is too short.";
  if (name.length > NAME_MAX_LENGTH) return `Keep the dish name under ${NAME_MAX_LENGTH} letters.`;
  if (draft.price.trim() && parseSuggestedPrice(draft.price) === null) {
    return "Enter the price as a number, like 4.50.";
  }
  return null;
}

/** "New dish: Chicken rice · S$4.50 · Half or whole" */
export function buildDishSuggestionNote(draft: DishSuggestionDraft): string {
  const price = parseSuggestedPrice(draft.price);
  const parts = [
    `New dish: ${draft.name.trim().replace(/\s+/g, " ")}`,
    price === null ? null : `S$${price.toFixed(2)}`,
    draft.details.trim().replace(/\s+/g, " ") || null,
  ].filter((part): part is string => part !== null);
  return parts.join(" · ").slice(0, NOTE_MAX_LENGTH);
}
