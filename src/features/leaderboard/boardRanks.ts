// Ranks shown away from the Leaderboard: the Rank stat on a Food Portfolio and the rank chip
// on People rows and review authors. One read of this week's Most active board (top 100) is
// shared by every caller for a minute, so a screen of rows costs one request, not one per row.

import { useEffect, useState } from "react";

import { rankCardModel } from "@/features/foodPortfolio/shareCards";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";

/** How many rows the shared board read asks for (the server's maximum). */
export const BOARD_RANKS_LIMIT = 100;
/** How long one board read is reused. */
export const BOARD_RANKS_TTL_MS = 60_000;
/** Rank chips show on rows only for diners this high up. */
export const RANK_CHIP_MAX = 50;

let cached: { at: number; promise: Promise<ReadonlyMap<string, number>> } | null = null;

/** This week's Most active ranks by user id. A failed read is not kept, so the next call retries. */
export function loadWeeklyRanks(now: number = Date.now()): Promise<ReadonlyMap<string, number>> {
  if (cached && now - cached.at < BOARD_RANKS_TTL_MS) return cached.promise;
  const promise = getHungryService()
    .leaderboard.getLeaderboard({ board: "active", period: "week", limit: BOARD_RANKS_LIMIT })
    .then((rows) => new Map(rows.map((row) => [row.userId, row.rank] as const)));
  const entry = { at: now, promise };
  cached = entry;
  promise.catch(() => {
    if (cached === entry) cached = null;
  });
  return promise;
}

/** Forget the shared board (tests, and after you post so your own rank refreshes). */
export function resetWeeklyRanks() {
  cached = null;
}

export type BoardRankState =
  | { state: "loading" }
  | { state: "failed" }
  /** rank null: not on the board yet. */
  | { state: "loaded"; rank: number | null; periodLabel: string | null };

/**
 * A diner's place on the Most active board. Yours comes from your own summary (this week, or all
 * time when you have no rank this week); anyone else's from this week's top 100.
 */
export function useBoardRank(
  userId: string | null | undefined,
  isSelf: boolean,
  enabled: boolean,
): BoardRankState {
  const [result, setResult] = useState<BoardRankState>({ state: "loading" });
  useEffect(() => {
    if (!enabled || !userId) return undefined;
    let active = true;
    setResult({ state: "loading" });
    const read: Promise<BoardRankState> = isSelf
      ? getHungryService()
          .leaderboard.getMySummary()
          .then((summary) => {
            const model = rankCardModel(summary);
            return {
              state: "loaded",
              rank: model?.rank ?? null,
              periodLabel: model?.periodLabel ?? null,
            };
          })
      : loadWeeklyRanks().then((ranks) => {
          const rank = ranks.get(userId) ?? null;
          return { state: "loaded", rank, periodLabel: rank ? "this week" : null };
        });
    read
      .then((next) => {
        if (active) setResult(next);
      })
      .catch((error) => {
        // A rank is a nice-to-have on a profile; the stat shows a dash and nothing else fails.
        reportError(error, { screen: "FoodPortfolio", action: "load_board_rank" });
        if (active) setResult({ state: "failed" });
      });
    return () => {
      active = false;
    };
  }, [enabled, isSelf, userId]);
  return result;
}

/** This week's ranks for rows of people (rank chips). Empty until loaded, or when the read fails. */
export function useWeeklyRanks(enabled: boolean): ReadonlyMap<string, number> {
  const [ranks, setRanks] = useState<ReadonlyMap<string, number>>(new Map());
  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    loadWeeklyRanks()
      .then((next) => {
        if (active) setRanks(next);
      })
      .catch((error) => {
        // Chips are extra: rows still show without them.
        reportError(error, { screen: "People", action: "load_weekly_ranks" });
      });
    return () => {
      active = false;
    };
  }, [enabled]);
  return ranks;
}

/** "#4" for a rank chip, or null when there is none to show. */
export function rankChipLabel(rank: number | null | undefined): string | null {
  return rank && rank > 0 && rank <= RANK_CHIP_MAX ? `#${rank}` : null;
}
