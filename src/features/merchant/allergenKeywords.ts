// Keyword check only: matches whole words in merchant-typed ingredient names.
// It cannot prove a dish is allergen-free; the merchant declares allergens.
const ALLERGEN_KEYWORDS: readonly (readonly [string, RegExp])[] = [
  ["Eggs", /\beggs?\b/],
  ["Soy", /\b(soy|soya|tofu|tempeh)\b/],
  ["Gluten", /\b(wheat|flour|egg noodles?|wonton|wantan)\b/],
  ["Peanuts", /\bpeanuts?\b/],
  ["Sesame", /\bsesame\b/],
  ["Shellfish", /\b(shrimps?|prawns?|crabs?|lobsters?)\b/],
];

export const ALLERGEN_CHECK_DISCLAIMER =
  "This is a keyword check of the ingredient names only. You are responsible for declaring allergens accurately.";

export function suggestAllergensFromIngredients(ingredients: readonly string[]): string[] {
  const lower = ingredients.map((ingredient) => ingredient.toLowerCase());
  return ALLERGEN_KEYWORDS.filter(([, pattern]) =>
    lower.some((ingredient) => pattern.test(ingredient)),
  ).map(([label]) => label);
}
