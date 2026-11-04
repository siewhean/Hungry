/** Which way a banner was thrown off the screen, if it was. */
export type SwipeAwayDirection = "up" | "left" | "right";

/** How far a banner must be dragged, in points, before letting go sends it away. */
export const SWIPE_AWAY_DISTANCE = 60;
/** A quick flick (points per millisecond) sends it away after a shorter drag. */
export const SWIPE_AWAY_VELOCITY = 0.5;
export const SWIPE_AWAY_FLICK_DISTANCE = 20;

/**
 * Reads a finished drag (how far it moved and how fast it was moving when the finger lifted) and
 * says which way the banner goes: up, left or right. Down is never an exit, so a banner pulled
 * down just springs back. The longer sideways or upward move wins when both qualify.
 */
export function swipeAwayDirection(gesture: {
  dx: number;
  dy: number;
  vx: number;
  vy: number;
}): SwipeAwayDirection | null {
  const { dx, dy, vx, vy } = gesture;
  const sideways =
    Math.abs(dx) >= SWIPE_AWAY_DISTANCE ||
    (Math.abs(vx) >= SWIPE_AWAY_VELOCITY && Math.abs(dx) >= SWIPE_AWAY_FLICK_DISTANCE);
  const upward =
    -dy >= SWIPE_AWAY_DISTANCE / 1.5 ||
    (-vy >= SWIPE_AWAY_VELOCITY && -dy >= SWIPE_AWAY_FLICK_DISTANCE);
  if (!sideways && !upward) return null;
  if (sideways && (!upward || Math.abs(dx) > -dy)) return dx < 0 ? "left" : "right";
  return "up";
}
