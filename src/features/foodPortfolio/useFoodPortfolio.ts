import { useCallback, useEffect, useRef, useState } from "react";

import {
  FOOD_PORTFOLIO_PAGE_SIZE,
  loadPortfolioPostsPage,
  loadPortfolioStalls,
  loadPortfolioTopPosts,
  mergePortfolioPosts,
  savePortfolioPins,
} from "@/features/foodPortfolio/foodPortfolioLoaders";
import type { Bite, FoodPortfolioStall } from "@/lib/services/types";

type LoadState = "loading" | "loaded" | "failed";

export interface FoodPortfolioState {
  posts: Bite[];
  postsState: LoadState;
  hasMorePosts: boolean;
  isLoadingMore: boolean;
  topPosts: Bite[];
  pinnedPostIds: string[];
  stalls: FoodPortfolioStall[];
  stallsState: LoadState;
  loadMore: () => void;
  retry: () => void;
  /** Saves new pins (owner only). Resolves false when the server refused. */
  savePins: (postIds: string[]) => Promise<boolean>;
}

/**
 * Everything one Food Portfolio shows: the posted dishes (paged), the top three and the stalls.
 * Each read fails on its own, so a failed stalls read keeps the dishes. `reloadKey` refetches
 * (the owner's grid after a post is published or deleted).
 */
export function useFoodPortfolio(
  userId: string | undefined,
  enabled: boolean,
  reloadKey: number = 0,
): FoodPortfolioState {
  const [posts, setPosts] = useState<Bite[]>([]);
  const [postsState, setPostsState] = useState<LoadState>("loading");
  const [loadedRows, setLoadedRows] = useState(0);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [topPosts, setTopPosts] = useState<Bite[]>([]);
  const [pinnedPostIds, setPinnedPostIds] = useState<string[]>([]);
  const [stalls, setStalls] = useState<FoodPortfolioStall[]>([]);
  const [stallsState, setStallsState] = useState<LoadState>("loading");
  const [retryKey, setRetryKey] = useState(0);
  const activeUserRef = useRef(userId);
  activeUserRef.current = userId;

  useEffect(() => {
    if (!userId || !enabled) return;
    let isActive = true;
    setPostsState("loading");
    setStallsState("loading");

    void loadPortfolioPostsPage(userId, 0).then((rows) => {
      if (!isActive) return;
      if (!rows) {
        setPostsState("failed");
        return;
      }
      setPosts(rows);
      setLoadedRows(rows.length);
      setHasMorePosts(rows.length === FOOD_PORTFOLIO_PAGE_SIZE);
      setPostsState("loaded");
    });
    void loadPortfolioTopPosts(userId).then((result) => {
      if (!isActive) return;
      setTopPosts(result.posts);
      setPinnedPostIds(result.pinnedPostIds);
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

  const loadMore = useCallback(() => {
    if (!userId || isLoadingMore || !hasMorePosts) return;
    setIsLoadingMore(true);
    void loadPortfolioPostsPage(userId, loadedRows)
      .then((rows) => {
        if (!rows || activeUserRef.current !== userId) return;
        setPosts((current) => mergePortfolioPosts(current, rows));
        setLoadedRows((current) => current + rows.length);
        setHasMorePosts(rows.length === FOOD_PORTFOLIO_PAGE_SIZE);
      })
      .finally(() => setIsLoadingMore(false));
  }, [hasMorePosts, isLoadingMore, loadedRows, userId]);

  const retry = useCallback(() => setRetryKey((key) => key + 1), []);

  const savePins = useCallback(async (postIds: string[]) => {
    const kept = await savePortfolioPins(postIds);
    if (!kept) return false;
    setPinnedPostIds(kept);
    // Re-read the top three so pins and "most liked" fill-ins are in the server's order.
    setRetryKey((key) => key + 1);
    return true;
  }, []);

  return {
    posts,
    postsState,
    hasMorePosts,
    isLoadingMore,
    topPosts,
    pinnedPostIds,
    stalls,
    stallsState,
    loadMore,
    retry,
    savePins,
  };
}
