// What the owner can do with one Food Portfolio diary entry, as the words of a choice sheet:
// make it the best of its dish type, put it in the top three, take it out, or switch it between
// Public and Only me. Each choice that replaces another pick names the dish it replaces. No React.

import type { ChoiceOption } from "@/store/useChoiceSheetStore";
import type { Bite, PortfolioDiaryEntry, PortfolioPicks } from "@/lib/services/types";

import { FOOD_PORTFOLIO_MAX_PINS } from "./foodPortfolioLoaders";

export type PortfolioEntryAction =
  | "best"
  | "remove_best"
  | "top_three"
  | "remove_top_three"
  | "private"
  | "public";

/** "chicken rice" for a dish type in a sentence. */
export function dishTypeWords(foodType: string): string {
  return foodType.trim().toLowerCase();
}

/** "Chicken rice at Tian Tian" for the dish a pick replaces. */
export function entryName(post: Pick<Bite, "dishName" | "venueName">): string {
  const dish = post.dishName?.trim() || "A dish";
  const stall = post.venueName?.trim();
  return stall ? `${dish} at ${stall}` : dish;
}

/** The current best of this entry's dish type, when it is another entry. */
export function replacedBest(entry: PortfolioDiaryEntry, picks: PortfolioPicks): Bite | undefined {
  const foodType = entry.dishFoodType?.trim();
  if (!foodType) return undefined;
  const best = picks.bests.find((pick) => pick.foodType === foodType);
  return best && best.post.id !== entry.post.id ? best.post : undefined;
}

/** The sheet for one entry: its title, what a best pick would replace, and the choices. */
export function entryActionSheet(
  entry: PortfolioDiaryEntry,
  picks: PortfolioPicks,
): { title: string; message?: string; options: ChoiceOption[] } {
  const title = entryName(entry.post);
  if (entry.visibility === "private") {
    return {
      title,
      message: "Only you can see this dish. It earns no points and can't be one of your picks.",
      options: [{ id: "public", label: "Make it public" }],
    };
  }
  const options: ChoiceOption[] = [];
  const foodType = entry.dishFoodType?.trim();
  const isBest = entry.pickKinds.includes("dish_type");
  const isTop = entry.pickKinds.includes("overall");
  let message: string | undefined;
  if (foodType) {
    if (isBest) {
      options.push({ id: "remove_best", label: `Stop being my best ${dishTypeWords(foodType)}` });
    } else {
      options.push({ id: "best", label: `Make this my best ${dishTypeWords(foodType)}` });
      const replaced = replacedBest(entry, picks);
      if (replaced) {
        message = `It replaces ${entryName(replaced)}, which stays in your diary.`;
      }
    }
  }
  options.push({
    id: "top_three",
    label: isTop ? "Move in my top three" : "Put in my top three",
  });
  if (isTop) options.push({ id: "remove_top_three", label: "Take out of my top three" });
  options.push({ id: "private", label: "Make it Only me" });
  return { title, message, options };
}

/** The places 1 to 3, each naming the dish it would replace. */
export function topThreePlaceOptions(
  entry: PortfolioDiaryEntry,
  picks: PortfolioPicks,
): ChoiceOption[] {
  return Array.from({ length: FOOD_PORTFOLIO_MAX_PINS }, (_, index) => {
    const place = index + 1;
    const holder = picks.topThree.find((pick) => pick.place === place)?.post;
    const label =
      holder && holder.id === entry.post.id
        ? `#${place} (here now)`
        : holder
          ? `#${place}, replaces ${entryName(holder)}`
          : `#${place}`;
    return { id: String(place), label };
  });
}

/** The entry after a change, so the diary updates without reading it again. */
export function applyEntryChange(
  entries: PortfolioDiaryEntry[],
  postId: string,
  action: PortfolioEntryAction,
  replacedPostId?: string,
): PortfolioDiaryEntry[] {
  const kind = action === "best" || action === "remove_best" ? "dish_type" : "overall";
  return entries.map((entry) => {
    if (entry.post.id === postId) {
      if (action === "private") return { ...entry, visibility: "private", pickKinds: [] };
      if (action === "public") return { ...entry, visibility: "public" };
      const kinds = entry.pickKinds.filter((item) => item !== kind);
      return {
        ...entry,
        pickKinds: action === "best" || action === "top_three" ? [...kinds, kind] : kinds,
      };
    }
    if (replacedPostId && entry.post.id === replacedPostId) {
      return { ...entry, pickKinds: entry.pickKinds.filter((item) => item !== kind) };
    }
    return entry;
  });
}
