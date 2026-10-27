import type { DietaryFlag } from "@/types/domain";

export const DIETARY_OPTIONS: {
  value: DietaryFlag;
  label: string;
  keywords: string[];
}[] = [
  { value: "vegetarian", label: "Vegetarian", keywords: ["veg"] },
  { value: "vegan", label: "Vegan", keywords: ["plant"] },
  { value: "halal", label: "Halal", keywords: ["muslim", "halal"] },
  { value: "gluten_free", label: "Gluten Free", keywords: ["gluten", "wheat"] },
  { value: "dairy_free", label: "Dairy Free", keywords: ["milk", "lactose"] },
  { value: "egg_free", label: "Egg Free", keywords: ["egg"] },
  {
    value: "nut_free",
    label: "Nut Free",
    keywords: ["nut", "peanut", "almond"],
  },
  { value: "peanut_free", label: "Peanut Free", keywords: ["peanut"] },
  {
    value: "shellfish_free",
    label: "Shellfish Free",
    keywords: ["shrimp", "prawn", "shellfish"],
  },
  { value: "soy_free", label: "Soy Free", keywords: ["soy", "tofu"] },
  { value: "sesame_free", label: "Sesame Free", keywords: ["sesame"] },
  { value: "pork_free", label: "Pork Free", keywords: ["pork"] },
  { value: "pescatarian", label: "Pescatarian", keywords: ["fish"] },
  { value: "kosher", label: "Kosher", keywords: ["jewish", "kosher"] },
  { value: "keto", label: "Keto", keywords: ["keto", "ketogenic"] },
  { value: "paleo", label: "Paleo", keywords: ["paleo"] },
  { value: "low_carb", label: "Low Carb", keywords: ["carb"] },
  { value: "low_sodium", label: "Low Sodium", keywords: ["salt", "sodium"] },
  { value: "low_sugar", label: "Low Sugar", keywords: ["sugar"] },
  {
    value: "diabetic_friendly",
    label: "Diabetic Friendly",
    keywords: ["diabetic", "diabetes", "glycemic"],
  },
  {
    value: "fodmap_friendly",
    label: "FODMAP Friendly",
    keywords: ["fodmap", "ibs"],
  },
  { value: "beef_free", label: "Beef Free", keywords: ["beef"] },
  {
    value: "allium_free",
    label: "Allium Free",
    keywords: ["onion", "garlic", "allium"],
  },
  { value: "fish_free", label: "Fish Free", keywords: ["fish"] },
  {
    value: "mollusc_free",
    label: "Mollusc Free",
    keywords: ["mollusc", "clam", "oyster", "mussel"],
  },
  { value: "celery_free", label: "Celery Free", keywords: ["celery"] },
  { value: "mustard_free", label: "Mustard Free", keywords: ["mustard"] },
  { value: "lupin_free", label: "Lupin Free", keywords: ["lupin"] },
  {
    value: "sulphite_free",
    label: "Sulphite Free",
    keywords: ["sulphite", "sulfite"],
  },
];

// The diets most Singapore diners look for come first; the rest sit behind "More".
export const POPULAR_DIETARY_FLAGS: DietaryFlag[] = [
  "halal",
  "vegetarian",
  "vegan",
  "pork_free",
  "beef_free",
  "nut_free",
  "shellfish_free",
  "gluten_free",
  "dairy_free",
];

export const BUDGET_OPTIONS: { label: string; value: number | undefined }[] = [
  { label: "Under S$6", value: 6 },
  { label: "Under S$12", value: 12 },
  { label: "Any price", value: undefined },
];

export const SORTED_DIETARY_OPTIONS = [
  ...POPULAR_DIETARY_FLAGS.map((flag) => DIETARY_OPTIONS.find((option) => option.value === flag)!),
  ...DIETARY_OPTIONS.filter((option) => !POPULAR_DIETARY_FLAGS.includes(option.value)),
];

/** The options a search matches, popular first; every option when the search is empty. */
export function filterDietaryOptions(query: string, selected: readonly DietaryFlag[]) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return SORTED_DIETARY_OPTIONS.filter(
      (option) => POPULAR_DIETARY_FLAGS.includes(option.value) || selected.includes(option.value),
    );
  }
  return SORTED_DIETARY_OPTIONS.filter((option) =>
    `${option.label} ${option.keywords.join(" ")}`.toLowerCase().includes(normalized),
  );
}
