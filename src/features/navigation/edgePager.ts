/**
 * The rules of the main pages' edge pager: a drag that starts in the thin band down a screen edge
 * pulls the neighbouring page in beside the current one, and lets go on whichever is nearer.
 * Pure, so the rules are tested without a screen.
 */
import { EDGE_SWIPE_ZONE } from "@/features/navigation/swipeIntent";

/** Sideways travel (pt) before the drag takes over the touch. */
export const EDGE_PAGER_ACTIVATE_DISTANCE = 12;
/** The sideways move must beat the up/down move by this much, so a scroll never becomes a drag. */
export const EDGE_PAGER_HORIZONTAL_RATIO = 1.5;
/** Past this share of the screen width, letting go settles on the next page. */
export const EDGE_PAGER_SETTLE_SHARE = 0.35;
/** A flick this fast (pt per ms) settles on the next page after a short drag. */
export const EDGE_PAGER_FLICK_VELOCITY = 0.35;
export const EDGE_PAGER_FLICK_DISTANCE = 24;

export type PagerDirection = "previous" | "next";

/**
 * Which way a drag may move the pages, or null when it is not an edge drag. From the left edge
 * moving right pulls the previous page in; from the right edge moving left pulls the next page.
 */
export function edgeDragDirection(input: {
  startX: number;
  dx: number;
  dy: number;
  width: number;
  index: number;
  pageCount: number;
}): PagerDirection | null {
  const { startX, dx, dy, width, index, pageCount } = input;
  if (width <= 0) return null;
  if (Math.abs(dx) <= EDGE_PAGER_ACTIVATE_DISTANCE) return null;
  if (Math.abs(dx) < Math.abs(dy) * EDGE_PAGER_HORIZONTAL_RATIO) return null;
  if (startX <= EDGE_SWIPE_ZONE && dx > 0 && index > 0) return "previous";
  if (startX >= width - EDGE_SWIPE_ZONE && dx < 0 && index < pageCount - 1) return "next";
  return null;
}

/** How far the pages move with the finger: one page at most, and only the way the drag began. */
export function clampEdgeDrag(dx: number, direction: PagerDirection, width: number): number {
  return direction === "previous"
    ? Math.min(Math.max(dx, 0), width)
    : Math.max(Math.min(dx, 0), -width);
}

/** The page the pager settles on when the finger lifts. */
export function edgeSettleIndex(input: {
  index: number;
  direction: PagerDirection;
  dx: number;
  vx: number;
  width: number;
}): number {
  const { index, direction, dx, vx, width } = input;
  const travelled = Math.abs(clampEdgeDrag(dx, direction, width));
  const towardsNext = direction === "next";
  // A flick the other way (or a drag back) cancels.
  const velocityAhead = towardsNext ? -vx : vx;
  const farEnough = travelled >= width * EDGE_PAGER_SETTLE_SHARE;
  const flicked =
    travelled >= EDGE_PAGER_FLICK_DISTANCE && velocityAhead >= EDGE_PAGER_FLICK_VELOCITY;
  if (!farEnough && !flicked) return index;
  if (velocityAhead < -EDGE_PAGER_FLICK_VELOCITY) return index;
  return towardsNext ? index + 1 : index - 1;
}

/** Whether a page is worth keeping mounted: the one on show, and its neighbours once warm. */
export function shouldMountPage(input: {
  pageIndex: number;
  focusedIndex: number;
  visited: boolean;
  warm: boolean;
}): boolean {
  const { pageIndex, focusedIndex, visited, warm } = input;
  return pageIndex === focusedIndex || visited || warm;
}
