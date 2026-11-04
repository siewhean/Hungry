/**
 * When Home offers the meal-picks push: after the diner has saved or tried something (so the
 * phone's one permission prompt comes once there is a reason), on a phone, while the phone has
 * not been asked yet, and not within two weeks of a "Not now".
 */
export type MealPicksNudgeInput = {
  isNative: boolean;
  signedIn: boolean;
  permission: "granted" | "denied" | "undetermined" | null;
  savedOrTriedCount: number;
  snoozed: boolean;
};

export function shouldOfferMealPicks(input: MealPicksNudgeInput): boolean {
  return (
    input.isNative &&
    input.signedIn &&
    input.permission === "undetermined" &&
    input.savedOrTriedCount > 0 &&
    !input.snoozed
  );
}
