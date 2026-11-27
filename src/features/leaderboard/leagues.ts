// Weekly leagues: tier names, the week clock and the line the score bar shows.
import type { LeagueStatus } from "@/lib/services/types";

/** Tier 1 to 5, as the server numbers them. */
export const LEAGUE_TIERS = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"] as const;

export function leagueTierName(tier: number): string {
  return LEAGUE_TIERS[Math.min(LEAGUE_TIERS.length, Math.max(1, Math.round(tier))) - 1];
}

/** "2d 5h left", "5h left", "12m left", or "Ends soon" in the last minute. */
export function weekTimeLeftLabel(weekEndsAt: string, now: Date = new Date()): string {
  const ms = Date.parse(weekEndsAt) - now.getTime();
  if (!Number.isFinite(ms) || ms < 60_000) return "Ends soon";
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h left`;
  return `${minutes}m left`;
}

/** "Gold league · #4" for a member, "Gold league" before the first points of the week. */
export function leaguePlaceLabel(status: LeagueStatus): string {
  const name = `${leagueTierName(status.tier)} league`;
  return status.isMember && status.rank ? `${name} · #${status.rank}` : name;
}

/**
 * What it takes to go up: "12 points to promotion", "In the promotion zone", or, at the top
 * tier or in a group too small to promote, the place alone. Always ends with the time left.
 */
export function leagueGoalLabel(status: LeagueStatus, now: Date = new Date()): string {
  const left = weekTimeLeftLabel(status.weekEndsAt, now);
  const topTier = status.tier >= LEAGUE_TIERS.length;
  if (!status.isMember) return `Earn points to join this week's league · ${left}`;
  if (topTier || status.promoteCount === 0 || status.pointsToPromotion === null) {
    return `Stay in the top ${status.cohortSize - status.relegateCount} · ${left}`;
  }
  if (status.pointsToPromotion <= 0) return `In the promotion zone · ${left}`;
  const unit = status.pointsToPromotion === 1 ? "point" : "points";
  return `${status.pointsToPromotion} ${unit} to promotion · ${left}`;
}

/** 0-1 toward the promotion line; full once you are in the promotion places. */
export function leagueProgress(status: LeagueStatus): number {
  if (!status.isMember || status.pointsToPromotion === null) return 0;
  if (status.pointsToPromotion <= 0) return 1;
  const goal = status.weekPoints + status.pointsToPromotion;
  return goal > 0 ? Math.min(1, status.weekPoints / goal) : 0;
}
