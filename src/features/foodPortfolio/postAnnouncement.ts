// What the composer says after a dish is posted to your Food Portfolio: "Posted to your Food
// Portfolio. +13 points." The points come from your points ledger, read once; if that read is
// slow or fails the toast goes out without them rather than holding the diner back.

import { getHungryService } from "@/lib/services/serviceProvider";
import type { PortfolioPointsEntry } from "@/lib/services/types";
import { reportError } from "@/lib/monitoring/reportError";

/** How long the toast waits for the points read. */
export const POST_POINTS_WAIT_MS = 1500;
/** Ledger rows read: a post's base points and its bonuses are separate rows. */
const POINTS_ROWS = 10;

/** The points one post earned: every live ledger row for it, added up. Null when none. */
export function pointsForPost(
  entries: readonly PortfolioPointsEntry[],
  postId: string,
): number | null {
  const rows = entries.filter((entry) => entry.postId === postId && !entry.voided);
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, entry) => sum + entry.points, 0);
  return total > 0 ? total : null;
}

/** Reads the points a new post earned, or null after `waitMs` or on any failure. */
export async function loadPostPoints(
  postId: string,
  waitMs: number = POST_POINTS_WAIT_MS,
): Promise<number | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), waitMs);
  });
  const read = getHungryService()
    .leaderboard.listMyPoints(POINTS_ROWS)
    .then((entries) => pointsForPost(entries, postId))
    .catch((error: unknown) => {
      reportError(error, { screen: "post_announcement", action: "read_points" });
      return null;
    });
  try {
    return await Promise.race([read, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** "Posted to your Food Portfolio. +13 points." */
export function postedToastMessage(points: number | null): string {
  return points
    ? `Posted to your Food Portfolio. +${points} ${points === 1 ? "point" : "points"}.`
    : "Posted to your Food Portfolio.";
}
