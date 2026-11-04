import { nearestStopIndex } from "./tasteSliderStops";

/** The price slider reuses the taste slider's pictures: one dish per price. */
export type PriceStop = {
  /** The most the person will pay for one dish, in S$. undefined: no limit. */
  budget: number | undefined;
  slug: string;
  dish: string;
  caption: string;
  bubble: string;
};

export const PRICE_STOPS: readonly [PriceStop, PriceStop, PriceStop, PriceStop, PriceStop] = [
  { budget: 3, slug: "kaya-toast", dish: "Kaya toast", caption: "Up to S$3", bubble: "S$3" },
  {
    budget: 6,
    slug: "spice-chicken-rice",
    dish: "Chicken rice",
    caption: "Up to S$6",
    bubble: "S$6",
  },
  { budget: 10, slug: "laksa", dish: "Laksa", caption: "Up to S$10", bubble: "S$10" },
  {
    budget: 15,
    slug: "sambal-stingray",
    dish: "Sambal stingray",
    caption: "Up to S$15",
    bubble: "S$15",
  },
  {
    budget: undefined,
    slug: "chilli-crab",
    dish: "Chilli crab",
    caption: "Any price",
    bubble: "Any",
  },
];

/** The stop (0 to 4) closest to a saved budget. No budget is the last stop; S$12 sits at S$10. */
export function priceStopForBudget(budget: number | undefined): number {
  if (budget === undefined) return PRICE_STOPS.length - 1;
  const limits = PRICE_STOPS.slice(0, -1).map((stop) => stop.budget!);
  let best = 0;
  limits.forEach((limit, index) => {
    if (Math.abs(limit - budget) < Math.abs(limits[best]! - budget)) best = index;
  });
  return best;
}

/** The budget a slider value (0 to 10) means. */
export function budgetForSliderValue(value: number): number | undefined {
  return PRICE_STOPS[nearestStopIndex(value)]!.budget;
}

/** The slider value (0, 2.5 ... 10) for a saved budget. */
export function sliderValueForBudget(budget: number | undefined): number {
  return priceStopForBudget(budget) * 2.5;
}

/** The text in the bubble above the thumb: "S$6", "S$10", "Any". */
export function priceBubble(value: number): string {
  return PRICE_STOPS[nearestStopIndex(value)]!.bubble;
}
