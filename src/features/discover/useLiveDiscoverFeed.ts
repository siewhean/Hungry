import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { DISCOVER_FEED_LIMIT } from "@/features/discover/bites";
import type { getDiscoverReadArgs } from "@/features/discover/discoverReadArgs";
import {
  clearCachedDiscoverFeed,
  DISCOVER_FEED_CACHE_MAX_AGE_MS,
  discardDiscoverFirstPage,
  peekDiscoverFirstPage,
} from "@/features/discover/feedCache";
import { mergeDiscoverFeeds } from "@/features/discover/feedMerge";
import { discoverFirstPageKey, loadDiscoverFirstPage } from "@/features/discover/warmHomeFeed";
import { reportError } from "@/lib/monitoring/reportError";
import { scheduleIdleWork } from "@/lib/performance/scheduleIdleWork";
import { getHungryService } from "@/lib/services/serviceProvider";
import {
  CatalogReadError,
  catalogReadOutcome,
  catalogRequestScope,
  type CatalogReadFailure,
} from "@/lib/services/catalogReads";
import type { DiscoveryLocationFeed } from "@/lib/services/types";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";

type FeedState = {
  key: string;
  attempt: number;
  phase: "partial" | "complete" | "failed";
  feed?: DiscoveryLocationFeed;
  firstPage?: DiscoveryLocationFeed;
  expiresAt?: number;
  failure?: CatalogReadFailure;
};

function requireLiveFeed(feed: DiscoveryLocationFeed | undefined): DiscoveryLocationFeed {
  if (feed?.isFallback) throw new CatalogReadError("Discover is unavailable.", "network");
  if (!feed) throw new CatalogReadError("Discover returned no response.", "contract");
  return feed;
}

/** A committed first page is the only trigger for the background reads. */
export function useLiveDiscoverFeed(
  enabled: boolean,
  args: ReturnType<typeof getDiscoverReadArgs>,
  currentPlaceId: string | undefined,
  isPlaceResolving: boolean,
) {
  // Subscribe to the same transitions the shared cache uses to rotate its session generation.
  useSessionStore((state) => state.isAuthenticated);
  useSessionStore((state) => state.authenticatedUserId);
  useSessionStore((state) => state.authDataSource);
  const isOffline = useUIStore((state) => state.isOffline);
  const wasOffline = useRef(isOffline);
  const scope = catalogRequestScope();
  const key = discoverFirstPageKey(scope, args);
  const [refresh, setRefresh] = useState({ key, attempt: 0 });
  const attempt = refresh.key === key ? refresh.attempt : 0;
  const [state, setState] = useState<FeedState>();
  const currentRequest = useRef({ key, attempt });
  useLayoutEffect(() => {
    currentRequest.current = { key, attempt };
  }, [key, attempt]);
  const latest = state?.key === key ? state : undefined;
  const firstPage =
    latest?.attempt === attempt && latest.phase === "partial" ? latest.firstPage : undefined;
  const staleExpiresAt = latest?.feed?.isFallback ? latest.expiresAt : undefined;

  useEffect(() => {
    if (staleExpiresAt === undefined) return;
    const timer = setTimeout(
      () => {
        setState((prior) =>
          prior?.key === key && prior.feed?.isFallback && prior.expiresAt === staleExpiresAt
            ? { ...prior, feed: undefined, expiresAt: undefined }
            : prior,
        );
      },
      Math.max(0, staleExpiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [key, staleExpiresAt]);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setRefresh((prior) => ({ key, attempt: prior.key === key ? prior.attempt + 1 : 1 }));
  }, [enabled, key]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const isCurrent = () =>
      active &&
      scope === catalogRequestScope() &&
      currentRequest.current.key === key &&
      currentRequest.current.attempt === attempt;

    const forceFresh = (wasOffline.current && !isOffline) || attempt > 0;
    wasOffline.current = isOffline;
    if (isOffline) {
      // Offline can use the already-settled same-scope page without waiting on a hung RPC.
      const cached = peekDiscoverFirstPage(key);
      void Promise.resolve(cached?.promise).then((cacheFeed) => {
        if (!isCurrent()) return;
        setState((prior) => {
          const priorVisible =
            prior?.key === key && prior.feed?.venues.length && (prior.expiresAt ?? 0) > Date.now();
          const visible = priorVisible ? prior.feed : cacheFeed;
          const expiresAt = priorVisible ? prior.expiresAt : cached?.expiresAt;
          return {
            key,
            attempt,
            phase: "failed",
            feed: visible?.venues.length ? { ...visible, isFallback: true } : undefined,
            expiresAt,
            failure: "network",
          };
        });
      });
      return () => {
        active = false;
      };
    }

    void loadDiscoverFirstPage(scope, args, forceFresh)
      .then(requireLiveFeed)
      .then((feed) => {
        if (!isCurrent()) return;
        setState({
          key,
          attempt,
          phase: feed.venues.length ? "partial" : "complete",
          feed,
          firstPage: feed.venues.length ? feed : undefined,
          expiresAt:
            peekDiscoverFirstPage(key)?.expiresAt ?? Date.now() + DISCOVER_FEED_CACHE_MAX_AGE_MS,
        });
      })
      .catch((error: unknown) => {
        if (!isCurrent()) return;
        const failure = catalogReadOutcome(error);
        if (failure === "auth") clearCachedDiscoverFeed();
        if (failure !== "cancelled") reportError(error, { surface: "discover_home_feed" });
        setState((prior) => {
          const keep =
            failure !== "auth" &&
            prior?.key === key &&
            prior.feed?.venues.length &&
            (prior.expiresAt ?? 0) > Date.now();
          return {
            key,
            attempt,
            phase: "failed",
            feed: keep && prior.feed ? { ...prior.feed, isFallback: true } : undefined,
            expiresAt: keep ? prior.expiresAt : undefined,
            failure,
          };
        });
      });
    return () => {
      active = false;
    };
  }, [args, attempt, enabled, isOffline, key, scope]);

  useEffect(() => {
    if (!enabled || isOffline || !firstPage) return;
    const first = firstPage;
    const discovery = getHungryService().discovery;
    if (!first.needsEnrichment || !discovery.enrichDiscoveryFeed) return;
    let active = true;
    const cancel = scheduleIdleWork(
      () => {
        void discovery.enrichDiscoveryFeed?.(first).then(
          (enriched) => {
            if (!active || scope !== catalogRequestScope()) return;
            setState((prior) =>
              prior?.key === key && prior.attempt === attempt && prior.phase === "partial"
                ? { ...prior, feed: enriched }
                : prior,
            );
          },
          (error: unknown) => {
            if (!active || scope !== catalogRequestScope()) return;
            if (catalogReadOutcome(error) === "auth") {
              clearCachedDiscoverFeed();
              setState((prior) =>
                prior?.key === key && prior.attempt === attempt
                  ? { key, attempt, phase: "failed", failure: "auth" }
                  : prior,
              );
            }
          },
        );
      },
      { timeout: 200 },
    );
    return () => {
      active = false;
      cancel();
    };
  }, [attempt, enabled, firstPage, isOffline, key, scope]);

  useEffect(() => {
    if (!enabled || !firstPage || isOffline || isPlaceResolving) return;
    let active = true;
    const first = firstPage;
    const discovery = getHungryService().discovery;
    const isCurrent = () =>
      active &&
      scope === catalogRequestScope() &&
      currentRequest.current.key === key &&
      currentRequest.current.attempt === attempt;

    const loadRemaining = async () => {
      try {
        const feed = requireLiveFeed(
          await discovery.listDiscoveryFeedByLocation({
            areaName: args.areaName,
            lat: args.geoCellLatitude,
            lng: args.geoCellLongitude,
            radiusMeters: args.radiusMeters,
            buildingId: currentPlaceId,
            limit: DISCOVER_FEED_LIMIT,
          }),
        );
        if (!isCurrent()) return;
        // A current successful read can omit a recently withdrawn venue or dish.
        const currentVenues = new Set(feed.venues.map(({ id }) => id));
        const currentDishes = new Set(feed.results.map(({ dish }) => dish.id));
        if (
          first.venues.some(({ id }) => !currentVenues.has(id)) ||
          first.results.some(({ dish }) => !currentDishes.has(dish.id))
        ) {
          discardDiscoverFirstPage(key);
        }
        setState({
          key,
          attempt,
          phase: "complete",
          feed: mergeDiscoverFeeds(first, feed),
          expiresAt: Date.now() + DISCOVER_FEED_CACHE_MAX_AGE_MS,
        });
      } catch (error: unknown) {
        if (!isCurrent()) return;
        const failure = catalogReadOutcome(error);
        if (failure !== "cancelled") reportError(error, { surface: "discover_home_feed" });
        if (failure === "auth") {
          clearCachedDiscoverFeed();
          setState({ key, attempt, phase: "failed", failure });
          return;
        }
        // The full feed is optional after the first page succeeds. Keep the live rows.
        setState((prior) =>
          prior?.key === key && prior.attempt === attempt
            ? { ...prior, phase: "failed", failure }
            : prior,
        );
      }
    };

    const cancel = scheduleIdleWork(() => void loadRemaining(), { timeout: 350 });
    return () => {
      active = false;
      cancel();
    };
  }, [args, attempt, currentPlaceId, enabled, firstPage, isOffline, isPlaceResolving, key, scope]);

  return {
    key,
    state: enabled ? latest : undefined,
    isLoading: enabled && (latest?.attempt !== attempt || latest.phase === "partial"),
    isRefreshing: enabled && attempt > 0 && latest?.attempt !== attempt,
    reload,
  };
}
