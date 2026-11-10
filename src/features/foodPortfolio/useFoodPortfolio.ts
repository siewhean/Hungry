import { useCallback, useEffect, useRef, useState } from "react";

import {
  FOOD_PORTFOLIO_DIARY_PAGE_SIZE,
  loadPortfolioDiaryPage,
  loadPortfolioPicks,
  loadPortfolioStalls,
  mergeDiaryEntries,
} from "@/features/foodPortfolio/foodPortfolioLoaders";
import {
  applyEntryChange,
  type PortfolioEntryAction,
} from "@/features/foodPortfolio/portfolioEntryActions";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { FoodPortfolioStall, PortfolioDiaryEntry, PortfolioPicks } from "@/lib/services/types";

type LoadState = "loading" | "loaded" | "failed";

const NO_PICKS: PortfolioPicks = { topThree: [], bests: [] };

export interface FoodPortfolioState {
  /** Every entry, newest first; the owner's include Only me entries. */
  entries: PortfolioDiaryEntry[];
  entriesState: LoadState;
  hasMoreEntries: boolean;
  isLoadingMore: boolean;
  picks: PortfolioPicks;
  stalls: FoodPortfolioStall[];
  stallsState: LoadState;
  loadMore: () => void;
  retry: () => void;
  /**
   * The owner changes one entry: a best, a top three place (1-3), or Public / Only me. Resolves
   * false when the server refused (already reported).
   */
  changeEntry: (
    entry: PortfolioDiaryEntry,
    action: PortfolioEntryAction,
    place?: number,
  ) => Promise<boolean>;
}

async function runEntryChange(
  entry: PortfolioDiaryEntry,
  action: PortfolioEntryAction,
  place?: number,
): Promise<string | undefined> {
  const portfolio = getHungryService().foodPortfolio;
  const postId = entry.post.id;
  switch (action) {
    case "best":
      return (await portfolio.setPick(postId, "dish_type")).replacedPostId;
    case "top_three":
      return (await portfolio.setPick(postId, "overall", place)).replacedPostId;
    case "remove_best":
      await portfolio.removePick(postId, "dish_type");
      return undefined;
    case "remove_top_three":
      await portfolio.removePick(postId, "overall");
      return undefined;
    case "private":
    case "public":
      await portfolio.setEntryVisibility(postId, action);
      return undefined;
  }
}

/**
 * Everything one Food Portfolio shows: the diary (paged), the top three and bests by dish type,
 * and the stalls. Each read fails on its own, so a failed stalls read keeps the diary.
 * `reloadKey` refetches (the owner's diary after a post is published or deleted).
 */
export function useFoodPortfolio(
  userId: string | undefined,
  enabled: boolean,
  reloadKey: number = 0,
): FoodPortfolioState {
  const [entries, setEntries] = useState<PortfolioDiaryEntry[]>([]);
  const [entriesState, setEntriesState] = useState<LoadState>("loading");
  const [hasMoreEntries, setHasMoreEntries] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [picks, setPicks] = useState<PortfolioPicks>(NO_PICKS);
  const [picksKey, setPicksKey] = useState(0);
  const [stalls, setStalls] = useState<FoodPortfolioStall[]>([]);
  const [stallsState, setStallsState] = useState<LoadState>("loading");
  const [retryKey, setRetryKey] = useState(0);
  const activeUserRef = useRef(userId);
  activeUserRef.current = userId;

  useEffect(() => {
    if (!userId || !enabled) return;
    let isActive = true;
    setEntriesState("loading");
    setStallsState("loading");

    void loadPortfolioDiaryPage(userId).then((rows) => {
      if (!isActive) return;
      if (!rows) {
        setEntriesState("failed");
        return;
      }
      setEntries(rows);
      setHasMoreEntries(rows.length === FOOD_PORTFOLIO_DIARY_PAGE_SIZE);
      setEntriesState("loaded");
    });
    void loadPortfolioStalls(userId).then((rows) => {
      if (!isActive) return;
      setStalls(rows ?? []);
      setStallsState(rows ? "loaded" : "failed");
    });

    return () => {
      isActive = false;
    };
  }, [enabled, reloadKey, retryKey, userId]);

  // Picks are read on their own so a change re-reads only them.
  useEffect(() => {
    if (!userId || !enabled) return;
    let isActive = true;
    void loadPortfolioPicks(userId).then((result) => {
      if (isActive) setPicks(result);
    });
    return () => {
      isActive = false;
    };
  }, [enabled, picksKey, reloadKey, retryKey, userId]);

  const loadMore = useCallback(() => {
    if (!userId || isLoadingMore || !hasMoreEntries) return;
    setIsLoadingMore(true);
    void loadPortfolioDiaryPage(userId, entries.at(-1))
      .then((rows) => {
        if (!rows || activeUserRef.current !== userId) return;
        setEntries((current) => mergeDiaryEntries(current, rows));
        setHasMoreEntries(rows.length === FOOD_PORTFOLIO_DIARY_PAGE_SIZE);
      })
      .finally(() => setIsLoadingMore(false));
  }, [entries, hasMoreEntries, isLoadingMore, userId]);

  const retry = useCallback(() => setRetryKey((key) => key + 1), []);

  const changeEntry = useCallback(
    async (entry: PortfolioDiaryEntry, action: PortfolioEntryAction, place?: number) => {
      try {
        const replacedPostId = await runEntryChange(entry, action, place);
        setEntries((current) => applyEntryChange(current, entry.post.id, action, replacedPostId));
        setPicksKey((key) => key + 1);
        return true;
      } catch (error) {
        reportError(error, { screen: "FoodPortfolio", action: `entry_${action}` });
        return false;
      }
    },
    [],
  );

  return {
    entries,
    entriesState,
    hasMoreEntries,
    isLoadingMore,
    picks,
    stalls,
    stallsState,
    loadMore,
    retry,
    changeEntry,
  };
}
