import type {
  LeaderboardBoard,
  LeaderboardPeriod,
  LeaderboardRow,
  LeaderboardSummary,
  PortfolioPointsEntry,
} from "@/lib/services/types";

/** Rows asked for per board; the server allows up to 100. */
export const LEADERBOARD_PAGE_SIZE = 50;
/** Below this many people a board shows a "be the first" card under its rows. */
export const LEADERBOARD_FULL_BOARD = 10;

/** Board achievements the server unlocks (achievement_unlocks.achievement_id). */
export const BOARD_ACHIEVEMENT_TITLES: Record<string, string> = {
  posted: "Posted",
  "first-to-post": "First to post",
  followed: "Followed",
  "weekly-contender": "Weekly contender",
  "crowd-favourite": "Crowd favourite",
};

/** "How points work", in the order the server applies them. */
export const PORTFOLIO_POINT_RULES: readonly { label: string; points: string }[] = [
  { label: "Dish post with a photo, at a stall", points: "10" },
  { label: "First post at a stall you never posted at", points: "+5" },
  { label: "First photo of that dish on Hungry", points: "+5" },
  { label: "A note of 80 characters or more, or a rating", points: "+3" },
  { label: "Post without a photo or a stall (off the board)", points: "2" },
  { label: "Achievement tier reached", points: "15 to 120" },
];

export const PORTFOLIO_POINT_LIMITS =
  "Up to 6 credited posts a day and 1 per stall every 30 minutes. A deleted or removed post loses its points. New accounts join the board after 7 days.";

export const TRENDING_RULES =
  "The last 7 days of follows (3), saves (2), shares (2) and likes (1) on your dishes. Each fades by half every 3 days, and each person counts once a day.";

export function boardScoreLabel(board: LeaderboardBoard, score: number): string {
  if (board === "trending") return `${score.toFixed(1)} trending`;
  const whole = Math.round(score);
  return `${whole} ${whole === 1 ? "pt" : "pts"}`;
}

export function rankLabel(rank: number | null | undefined): string {
  return rank && rank > 0 ? `#${rank}` : "Not ranked yet";
}

/** Your rank on the board being shown. */
export function summaryRankFor(
  summary: LeaderboardSummary | null,
  board: LeaderboardBoard,
  period: LeaderboardPeriod,
): number | null {
  if (!summary) return null;
  if (board === "trending") return summary.trendingRank;
  return period === "all" ? summary.activeAllRank : summary.activeWeekRank;
}

/** True when you are ranked but outside the rows shown, so your row is pinned below them. */
export function shouldPinOwnRow(rows: LeaderboardRow[], ownRank: number | null): boolean {
  return Boolean(ownRank) && !rows.some((row) => row.isMe);
}

export function portfolioPointsLabel(entry: PortfolioPointsEntry): string {
  switch (entry.kind) {
    case "post":
      return "Dish posted";
    case "off_board_post":
      return "Dish posted (off the board)";
    case "new_stall":
      return "New stall";
    case "first_dish_photo":
      return "First photo of this dish";
    case "rich_post":
      return "Detailed post";
    case "achievement": {
      const title = BOARD_ACHIEVEMENT_TITLES[entry.achievementId ?? ""] ?? "Achievement";
      return entry.tier ? `${title}, tier ${entry.tier}` : title;
    }
    default:
      return "Points";
  }
}

export function portfolioPointsValue(entry: PortfolioPointsEntry): string {
  const whole = Math.round(entry.points);
  return entry.voided ? "Removed" : `+${whole}`;
}

/** "3 of 6 credited posts today", or the cap reached. */
export function dailyCreditLabel(summary: LeaderboardSummary): string {
  if (summary.creditedPostsToday >= summary.dailyCap) {
    return `All ${summary.dailyCap} credited posts used today`;
  }
  return `${summary.creditedPostsToday} of ${summary.dailyCap} credited posts today`;
}
