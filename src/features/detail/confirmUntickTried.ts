import { askChoice } from "@/store/useChoiceSheetStore";

/**
 * Asks before a dish comes off the Tried list. A reviewed dish keeps its review, and the
 * "dishes tried" achievement counts one fewer. Resolves true when the diner confirms.
 */
export async function confirmUntickTried(dishName: string, hasReview: boolean): Promise<boolean> {
  const choice = await askChoice({
    title: `Mark ${dishName} as not tried?`,
    message: hasReview
      ? "Your review stays. It comes off your tried dishes and your achievements count one fewer."
      : "It comes off your tried dishes and your achievements count one fewer.",
    options: [{ id: "untick", label: "Mark not tried", destructive: true }],
  });
  return choice === "untick";
}
