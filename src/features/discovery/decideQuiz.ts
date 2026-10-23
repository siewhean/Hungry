/**
 * Decide for Me questions: cuisine, rice or noodles, price and flavour. Every question has a
 * "Decide for me" answer that leaves that question open, so a diner can answer one question
 * or none. The answers narrow the taste-ranked candidates and never empty the list.
 */
import type { DishDetail, TasteVector } from "@/types/domain";

export type DecideQuestionId = "cuisine" | "staple" | "price" | "flavour";

export type DecideOption = {
  id: string;
  label: string;
  /** Words matched against the dish name, food type tag and taste tags. */
  keywords?: string[];
  /** Price ceiling in S$ for the price question. */
  maxPrice?: number;
  /** Taste axis that must be strong for the flavour question. */
  axis?: keyof TasteVector;
};

export type DecideQuestion = {
  id: DecideQuestionId;
  title: string;
  options: DecideOption[];
};

/** The id every question uses for "leave this to the app". */
export const DECIDE_FOR_ME_OPTION_ID = "decide";

const DECIDE_OPTION: DecideOption = { id: DECIDE_FOR_ME_OPTION_ID, label: "Decide for me" };

export const DECIDE_QUESTIONS: readonly DecideQuestion[] = [
  {
    id: "cuisine",
    title: "What kind of food?",
    options: [
      { id: "local", label: "Local", keywords: ["local", "singapore", "hawker"] },
      { id: "chinese", label: "Chinese", keywords: ["chinese", "cantonese", "teochew", "hokkien"] },
      { id: "malay", label: "Malay", keywords: ["malay", "nasi", "satay"] },
      { id: "indian", label: "Indian", keywords: ["indian", "prata", "biryani", "curry"] },
      {
        id: "japanese-korean",
        label: "Japanese or Korean",
        keywords: ["japanese", "korean", "ramen", "sushi"],
      },
      { id: "western", label: "Western", keywords: ["western", "burger", "pasta", "steak"] },
      DECIDE_OPTION,
    ],
  },
  {
    id: "staple",
    title: "Rice, noodles or something else?",
    options: [
      { id: "rice", label: "Rice", keywords: ["rice", "nasi", "biryani"] },
      {
        id: "noodles",
        label: "Noodles",
        keywords: ["noodle", "mee", "laksa", "ramen", "pasta", "kway teow", "bee hoon"],
      },
      { id: "soup", label: "Soup", keywords: ["soup", "bak kut teh", "broth"] },
      {
        id: "snack",
        label: "Snack or bread",
        keywords: ["prata", "bread", "satay", "snack", "toast"],
      },
      {
        id: "dessert",
        label: "Dessert or drink",
        keywords: ["dessert", "drink", "ice", "cendol", "tea", "coffee"],
      },
      DECIDE_OPTION,
    ],
  },
  {
    id: "price",
    title: "How much do you want to spend?",
    options: [
      { id: "under5", label: "Under S$5", maxPrice: 5 },
      { id: "under8", label: "Under S$8", maxPrice: 8 },
      { id: "under12", label: "Under S$12", maxPrice: 12 },
      DECIDE_OPTION,
    ],
  },
  {
    id: "flavour",
    title: "What flavour are you after?",
    options: [
      { id: "spicy", label: "Spicy", axis: "spicy" },
      { id: "sweet", label: "Sweet", axis: "sweet" },
      { id: "sour", label: "Sour or tangy", axis: "sour" },
      { id: "rich", label: "Rich and savoury", axis: "rich" },
      DECIDE_OPTION,
    ],
  },
];

/** Chosen option id per question; a missing question counts as "Decide for me". */
export type DecideAnswers = Partial<Record<DecideQuestionId, string>>;

/** Level at which a dish counts as having the flavour the diner asked for. */
const FLAVOUR_MIN_LEVEL = 6;

function findOption(
  questionId: DecideQuestionId,
  answers: DecideAnswers,
): DecideOption | undefined {
  const chosen = answers[questionId];
  if (!chosen || chosen === DECIDE_FOR_ME_OPTION_ID) return undefined;
  return DECIDE_QUESTIONS.find((question) => question.id === questionId)?.options.find(
    (option) => option.id === chosen,
  );
}

function dishText(dish: DishDetail): string {
  return [dish.name, dish.foodTypeTag ?? "", ...dish.tasteTags].join(" ").toLowerCase();
}

function matchesKeywords(dish: DishDetail, keywords: string[] | undefined): boolean {
  if (!keywords?.length) return true;
  const text = dishText(dish);
  return keywords.some((keyword) => text.includes(keyword));
}

/** True when at least one answer narrows the search. */
export function hasDecideConstraints(answers: DecideAnswers): boolean {
  return (["cuisine", "staple", "price", "flavour"] as const).some((id) =>
    Boolean(findOption(id, answers)),
  );
}

/**
 * Keeps the dishes that fit every answered question. Each question is applied in turn and a
 * question that would empty the list is skipped, so the diner always gets something to eat.
 */
export function filterByDecideAnswers(dishes: DishDetail[], answers: DecideAnswers): DishDetail[] {
  let current = dishes;
  const apply = (keep: (dish: DishDetail) => boolean) => {
    const next = current.filter(keep);
    if (next.length) current = next;
  };
  const cuisine = findOption("cuisine", answers);
  if (cuisine) apply((dish) => matchesKeywords(dish, cuisine.keywords));
  const staple = findOption("staple", answers);
  if (staple) apply((dish) => matchesKeywords(dish, staple.keywords));
  const price = findOption("price", answers);
  if (price?.maxPrice !== undefined) {
    const ceiling = price.maxPrice;
    apply((dish) => dish.price > 0 && dish.price <= ceiling);
  }
  const flavour = findOption("flavour", answers);
  if (flavour?.axis) {
    const axis = flavour.axis;
    apply((dish) => dish.tasteVector[axis] >= FLAVOUR_MIN_LEVEL);
  }
  return current;
}
