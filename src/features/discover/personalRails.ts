import type { Bite } from "@/lib/services/types";

/** The part of the day Home tailors a rail to. Late night has its own rail already. */
export type MealPeriod = "breakfast" | "lunch" | "teaTime" | "dinner" | "lateNight";

export function mealPeriodForHour(hour: number): MealPeriod {
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 17) return "teaTime";
  if (hour >= 17 && hour < 22) return "dinner";
  return "lateNight";
}

type MealRail = {
  title: string;
  seeAllLabel: string;
  /** Dish-name words that suit the time of day. */
  keywords: readonly string[];
};

export const MEAL_RAILS: Record<Exclude<MealPeriod, "lateNight">, MealRail> = {
  breakfast: {
    title: "Good for breakfast",
    seeAllLabel: "See breakfast dishes",
    keywords: [
      "toast",
      "kaya",
      "kopi",
      "coffee",
      "congee",
      "porridge",
      "prata",
      "nasi lemak",
      "egg",
      "soya",
      "you tiao",
      "chee cheong fun",
      "dim sum",
      "bread",
      "pancake",
      "mee siam",
    ],
  },
  lunch: {
    title: "Lunch picks",
    seeAllLabel: "See lunch dishes",
    keywords: [
      "rice",
      "noodle",
      "mee",
      "laksa",
      "kway teow",
      "bee hoon",
      "hor fun",
      "nasi",
      "briyani",
      "curry",
      "wanton",
      "ramen",
      "soup",
      "yong tau foo",
    ],
  },
  teaTime: {
    title: "Tea-time treats",
    seeAllLabel: "See tea-time treats",
    keywords: [
      "cake",
      "kueh",
      "dessert",
      "ice",
      "cendol",
      "chendol",
      "tea",
      "coffee",
      "toast",
      "waffle",
      "tart",
      "puff",
      "bubble",
      "tau huay",
      "pancake",
    ],
  },
  dinner: {
    title: "Dinner ideas",
    seeAllLabel: "See dinner dishes",
    keywords: [
      "bak kut teh",
      "crab",
      "chilli",
      "prawn",
      "satay",
      "steamboat",
      "hotpot",
      "claypot",
      "fish head",
      "bbq",
      "rice",
      "noodle",
      "curry",
      "briyani",
      "steak",
      "zi char",
    ],
  },
};

/** The dishes whose names suit the part of the day, in the order given. */
export function bitesForMealPeriod(bites: readonly Bite[], period: MealPeriod): Bite[] {
  if (period === "lateNight") return [];
  const { keywords } = MEAL_RAILS[period];
  return bites.filter((bite) => {
    const name = bite.dishName.toLowerCase();
    return keywords.some((keyword) => name.includes(keyword));
  });
}

/** Words too common in dish names to mean "the same kind of food". */
const GENERIC_WORDS = new Set(["with", "and", "special", "set", "fried", "the", "style"]);

/**
 * Dishes of the same kind as one the diner saved or reviewed: the same name, or the same last
 * word ("Prawn Laksa" -> "Laksa"). The dish itself is left out.
 */
export function bitesLikeDish(bites: readonly Bite[], dishName: string): Bite[] {
  const target = dishName.trim().toLowerCase();
  if (!target) return [];
  const lastWord = target.split(/\s+/).pop() ?? "";
  const useLastWord = lastWord.length >= 4 && !GENERIC_WORDS.has(lastWord);
  return bites.filter((bite) => {
    const name = bite.dishName.toLowerCase();
    if (name === target) return false;
    return name.includes(target) || (useLastWord && name.split(/\s+/).includes(lastWord));
  });
}

/** "prawn laksa" -> "Prawn Laksa" (names are kept lower-case for matching). */
export function toTitleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}
