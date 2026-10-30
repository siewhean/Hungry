import { getMerchantProfileGaps } from "@/features/merchant/merchantReadiness";
import type { MerchantOutlet } from "@/types/domain";

/** Dishes a stall needs before the menu looks worth opening. */
export const SETUP_MIN_DISHES = 5;

export type SetupItemId = "verify" | "dishes" | "hours" | "photo";
export type SetupAction = "verification" | "menu" | "profile";

export interface SetupItem {
  id: SetupItemId;
  label: string;
  detail: string;
  done: boolean;
  action: SetupAction;
}

/**
 * What a new merchant still has to do before the stall is ready: verify, five dishes, opening
 * hours and a photo. Built from the outlet and the dish count only, so it can be shown before
 * verification, when Home and Performance are locked.
 */
export function buildSetupChecklist(
  outlet: MerchantOutlet,
  dishCount: number,
): { items: SetupItem[]; doneCount: number } {
  const gaps = new Set(
    getMerchantProfileGaps(outlet, { menuCount: dishCount, dishesWithoutImages: 0 }).map(
      (gap) => gap.id,
    ),
  );
  const status = outlet.verification.status;
  const submitted = status === "submitted" || status === "in_review";
  const verified = status === "verified";
  const items: SetupItem[] = [
    {
      id: "verify",
      label: "Verify your stall",
      detail: verified
        ? "Verified"
        : submitted
          ? "Sent. Hungry is reviewing it, usually within a few working days."
          : "Send a licence photo or a video walkaround.",
      done: verified || submitted,
      action: "verification",
    },
    {
      id: "dishes",
      label: `Add ${SETUP_MIN_DISHES} dishes`,
      detail: `${Math.min(dishCount, SETUP_MIN_DISHES)} of ${SETUP_MIN_DISHES} added`,
      done: dishCount >= SETUP_MIN_DISHES,
      action: "menu",
    },
    {
      id: "hours",
      label: "Add opening hours",
      detail: gaps.has("opening-hours") ? "Diners look for hours first." : "Added",
      done: !gaps.has("opening-hours"),
      action: "profile",
    },
    {
      id: "photo",
      label: "Add a photo",
      detail:
        gaps.has("profile-image") && gaps.has("cover-image")
          ? "A logo or a cover photo of your stall."
          : "Added",
      done: !(gaps.has("profile-image") && gaps.has("cover-image")),
      action: "profile",
    },
  ];
  return { items, doneCount: items.filter((item) => item.done).length };
}
