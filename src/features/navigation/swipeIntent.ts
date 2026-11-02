/**
 * What a horizontal swipe means on a page: a swipe that starts at a screen edge moves between the
 * app's pages (the system's own back swipe owns the left edge inside a stack), and a swipe that
 * starts anywhere else moves between the sections of the page itself (Dishes / Stalls,
 * All / For you). Pure, so the rules are tested without a screen.
 */

/** A swipe that starts this close (pt) to a screen edge belongs to page navigation. */
export const EDGE_SWIPE_ZONE = 28;
/** Distance (pt) a swipe must travel, or travel with a flick, to count. */
export const SWIPE_MIN_DISTANCE = 64;
export const SWIPE_FLICK_DISTANCE = 32;
export const SWIPE_FLICK_VELOCITY = 600;
/** The swipe must be this much more sideways than up or down, so a scroll is never a swipe. */
export const SWIPE_HORIZONTAL_RATIO = 1.8;

export type SwipeIntent =
  /** From the left edge, moving right: the previous page. */
  | "edge-from-left"
  /** From the right edge, moving left: the next page. */
  | "edge-from-right"
  /** Moving left inside the page: the next section. */
  | "content-left"
  /** Moving right inside the page: the previous section. */
  | "content-right";

export function classifySwipe(input: {
  startX: number;
  translationX: number;
  translationY: number;
  velocityX: number;
  screenWidth: number;
}): SwipeIntent | null {
  const { startX, translationX, translationY, velocityX, screenWidth } = input;
  const distance = Math.abs(translationX);
  if (distance < SWIPE_FLICK_DISTANCE) return null;
  if (distance < Math.abs(translationY) * SWIPE_HORIZONTAL_RATIO) return null;
  const travelled =
    distance >= SWIPE_MIN_DISTANCE ||
    (distance >= SWIPE_FLICK_DISTANCE && Math.abs(velocityX) >= SWIPE_FLICK_VELOCITY);
  if (!travelled) return null;
  const movingRight = translationX > 0;
  if (startX <= EDGE_SWIPE_ZONE) return movingRight ? "edge-from-left" : null;
  if (startX >= screenWidth - EDGE_SWIPE_ZONE) return movingRight ? null : "edge-from-right";
  return movingRight ? "content-right" : "content-left";
}

export type TabDirection = "previous" | "next";

/** The tab key a swipe lands on, or undefined at either end of the bar. */
export function adjacentTabKey<T extends string>(
  order: readonly T[],
  current: T,
  direction: TabDirection,
): T | undefined {
  const index = order.indexOf(current);
  if (index < 0) return undefined;
  return order[index + (direction === "next" ? 1 : -1)];
}

/**
 * The main tab bar from left to right. `Create` is the Post button: it opens the review card
 * from the bottom instead of a tab page.
 */
export type MainTabKey = "Discover" | "Home" | "Create" | "Review" | "Profile";

export function mainTabOrder(flags: {
  socialFeedEnabled: boolean;
  reviewCreationEnabled: boolean;
}): MainTabKey[] {
  return [
    "Discover",
    ...(flags.socialFeedEnabled ? (["Home"] as const) : []),
    ...(flags.reviewCreationEnabled ? (["Create", "Review"] as const) : []),
    "Profile",
  ];
}
