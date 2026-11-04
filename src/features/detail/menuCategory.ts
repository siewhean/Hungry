import { getDishSection } from "@/features/merchant/menuSections";
import type { DishDetail } from "@/types/domain";

export const ALL_MENU_CATEGORY = "All";
export const ADD_ONS_CATEGORY = "Add-ons";

/** Name-based categories in chip order. Owner sections sort after these, Add-ons last. */
export const MENU_CATEGORY_ORDER = [
  "Popular",
  "Rice",
  "Noodles",
  "Chicken",
  "Seafood",
  "Vegetarian",
  "Drinks",
  "Dessert",
  "Sets",
  "Sides",
];

/** Position of a category among the chips: known, then the owner's own sections, then Add-ons. */
export function menuCategoryRank(category: string): number {
  if (category === ADD_ONS_CATEGORY) return MENU_CATEGORY_ORDER.length + 1;
  const index = MENU_CATEGORY_ORDER.indexOf(category);
  return index === -1 ? MENU_CATEGORY_ORDER.length : index;
}

export function compareMenuCategories(left: string, right: string): number {
  return menuCategoryRank(left) - menuCategoryRank(right) || left.localeCompare(right);
}

/** "Earle's Butter S$1", "Fudge or Fruit Topping", a "+2" price: extras, not dishes. */
function isAddOn(dish: DishDetail): boolean {
  if (dish.priceRange?.trim().startsWith("+")) return true;
  return (
    dish.price > 0 && dish.price < 2 && /\b(toppings?|add[- ]?ons?|extras?)\b/i.test(dish.name)
  );
}

/**
 * The menu chip a dish sits under. Only the owner's sections and the fixed name-based list
 * become categories: a free-text availability flag ("Fresh Catch Daily") never does.
 */
export function inferDishCategory(dish: DishDetail): string {
  // A section the stall owner picked wins over name-based guesses.
  const merchantSection = getDishSection(dish.availabilityFlags);
  if (merchantSection) return merchantSection;
  if (isAddOn(dish)) return ADD_ONS_CATEGORY;
  const name = dish.name.toLowerCase();
  if (dish.mustOrder) return "Popular";
  // Whole words only: "Steak" is not tea, "Watercress soup" is not water.
  if (/\b(rice|nasi|biryani|donburi|porridge|congee)\b/.test(name)) return "Rice";
  if (/\b(noodles?|mee|hor fun|kway teow|ramen|pasta|spaghetti|bee hoon|udon|soba)\b/.test(name)) {
    return "Noodles";
  }
  if (/\b(chicken|ayam|wings?|drumsticks?)\b/.test(name)) return "Chicken";
  if (/\b(fish|prawns?|crabs?|seafood|squid|sotong|salmon)\b/.test(name)) return "Seafood";
  if (/\b(vegetarian|vegan|tofu|mushrooms?|salad)\b/.test(name)) return "Vegetarian";
  if (/\b(coffee|tea|milo|juice|drinks?|latte|smoothie|water|soda|kopi|teh)\b/.test(name)) {
    return "Drinks";
  }
  if (/\b(cakes?|dessert|ice cream|pudding|waffles?|tarts?|muffins?)\b/.test(name)) {
    return "Dessert";
  }
  if (/\b(set|combo|meal|bundle|platter)\b/.test(name)) return "Sets";
  if (/\b(sides?|fries|snacks?|toast|bread)\b/.test(name)) return "Sides";

  const dietaryLabels = dish.dietaryFlags ?? [];
  if (dietaryLabels.some((label) => /vegetarian|vegan/i.test(label))) return "Vegetarian";

  return "Menu";
}
