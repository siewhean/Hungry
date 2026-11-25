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
  preview?: DiscoveryLocationFeed;
  fullRead?: { placeId: string | undefined; succeeded: boolean };
  expiresAt?: number;
  failure?: CatalogReadFailure;
};

function requireLiveFeed(feed: DiscoveryLocationFeed | undefined): DiscoveryLocationFeed {
  if (feed?.isFallback) throw new CatalogReadError("Discover is unavailable.", "network");
  if (!feed) throw new CatalogReadError("Discover returned no response.", "contract");
  return feed;
}

function shouldShowPreview(
  state: FeedState,
  placeId: string | undefined,
  isPlaceResolving: boolean,
) {
  return (
    state.fullRead !== undefined &&
    (isPlaceResolving || state.fullRead.placeId !== placeId || !state.fullRead.succeeded)
  );
}

/** A full read can withdraw items from the geographic preview that stays between building reads. */
function refreshGeographicPreview(first: DiscoveryLocationFeed, full: DiscoveryLocationFeed) {
  const previewVenueIds = new Set(first.venues.map(({ id }) => id));
  const venues = full.venues.filter(({ id }) => previewVenueIds.has(id));
  if (!venues.length) return undefined;

  const authorizedPreviewVenueIds = new Set(venues.map(({ id }) => id));
  return mergeDiscoverFeeds(first, {
    ...full,
    venues,
    results: full.results.filter(({ dish }) => authorizedPreviewVenueIds.has(dish.venueId)),
  });
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
  const currentRequest = useRef({
    key,
    attempt,
    enabled,
    isOffline,
    currentPlaceId,
    isPlaceResolving,
  });
  useLayoutEffect(() => {
    currentRequest.current = { key, attempt, enabled, isOffline, currentPlaceId, isPlaceResolving };
  }, [key, attempt, enabled, isOffline, currentPlaceId, isPlaceResolving]);
  const isCurrentPreview = useCallback(() => {
    const current = currentRequest.current;
    return (
      current.enabled &&
      current.isOffline === isOffline &&
      scope === catalogRequestScope() &&
      current.key === key &&
      current.attempt === attempt
    );
  }, [attempt, isOffline, key, scope]);
  const latest = state?.key === key ? state : undefined;
  const firstPage = latest?.attempt === attempt ? latest.firstPage : undefined;
  const hasFullReplacement = latest?.phase === "complete";
  const hasSettledForPlace =
    !isPlaceResolving &&
    latest?.fullRead !== undefined &&
    latest.fullRead.placeId === currentPlaceId;
  const isLoadingWiderFeed = firstPage !== undefined && !hasSettledForPlace;
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
    const isCurrent = () => active && isCurrentPreview();
    // The first-page scope is geographic, so a retained outage snapshot must also be geographic.
    const getGeographicFallback = (prior: FeedState | undefined) => {
      if (prior?.key !== key) return undefined;
      return prior.fullRead ? prior.preview : prior.feed;
    };

    const forceFresh = (wasOffline.current && !isOffline) || attempt > 0;
    wasOffline.current = isOffline;
    if (isOffline) {
      // Offline can use the already-settled same-scope page without waiting on a hung RPC.
      const cached = peekDiscoverFirstPage(key);
      void Promise.resolve(cached?.promise).then((cacheFeed) => {
        if (!isCurrent()) return;
        setState((prior) => {
          const priorFeed = getGeographicFallback(prior);
          const priorVisible = priorFeed?.venues.length && (prior?.expiresAt ?? 0) > Date.now();
          const visible = priorVisible ? priorFeed : cacheFeed;
          const expiresAt = priorVisible ? prior?.expiresAt : cached?.expiresAt;
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
          preview: feed.venues.length ? feed : undefined,
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
          const previousFeed = getGeographicFallback(prior);
          const keep =
            failure !== "auth" &&
            previousFeed?.venues.length &&
            (prior?.expiresAt ?? 0) > Date.now();
          return {
            key,
            attempt,
            phase: "failed",
            feed: keep ? { ...previousFeed, isFallback: true } : undefined,
            expiresAt: keep ? prior?.expiresAt : undefined,
            failure,
          };
        });
      });
    return () => {
      active = false;
    };
  }, [args, attempt, enabled, isCurrentPreview, isOffline, key, scope]);

  useEffect(() => {
    if (!enabled || isOffline || !firstPage || hasFullReplacement) return;
    const first = firstPage;
    const discovery = getHungryService().discovery;
    if (!first.needsEnrichment || !discovery.enrichDiscoveryFeed) return;
    let active = true;
    const cancel = scheduleIdleWork(
      () => {
        void discovery.enrichDiscoveryFeed?.(first).then(
          (enriched) => {
            if (!active || !isCurrentPreview()) return;
            setState((prior) =>
              prior?.key === key &&
              prior.attempt === attempt &&
              prior.firstPage === first &&
              prior.phase !== "complete"
                ? { ...prior, feed: enriched, preview: enriched }
                : prior,
            );
          },
          (error: unknown) => {
            if (!active || !isCurrentPreview()) return;
            if (catalogReadOutcome(error) === "auth") {
              clearCachedDiscoverFeed();
              setState((prior) =>
                prior?.key === key &&
                prior.attempt === attempt &&
                prior.firstPage === first &&
                prior.phase !== "complete"
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
  }, [attempt, enabled, firstPage, hasFullReplacement, isCurrentPreview, isOffline, key]);

  useEffect(() => {
    if (!enabled || !firstPage || isOffline || isPlaceResolving || hasSettledForPlace) return;
    let active = true;
    const first = firstPage;
    const discovery = getHungryService().discovery;
    const startedFor = currentRequest.current;
    const isCurrent = () => active && isCurrentPreview() && currentRequest.current === startedFor;

    const loadRemaining = async () => {
      if (!isCurrent()) return;
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
          firstPage: first,
          preview: refreshGeographicPreview(first, feed),
          fullRead: { placeId: currentPlaceId, succeeded: true },
          feed: mergeDiscoverFeeds(first, feed, currentPlaceId),
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
            ? {
                ...prior,
                phase: prior.phase === "complete" ? "complete" : "failed",
                fullRead: { placeId: currentPlaceId, succeeded: false },
                failure,
              }
            : prior,
        );
      }
    };

    const cancel = scheduleIdleWork(() => void loadRemaining(), { timeout: 350 });
    return () => {
      active = false;
      cancel();
    };
  }, [
    args,
    attempt,
    currentPlaceId,
    enabled,
    firstPage,
    hasSettledForPlace,
    isCurrentPreview,
    isOffline,
    isPlaceResolving,
    key,
  ]);

  const visible: FeedState | undefined =
    latest && shouldShowPreview(latest, currentPlaceId, isPlaceResolving)
      ? {
          ...latest,
          phase: isLoadingWiderFeed ? "partial" : "failed",
          feed: latest.preview,
          failure: isLoadingWiderFeed ? undefined : latest.failure,
        }
      : latest;
  return {
    key,
    state: enabled ? visible : undefined,
    isLoading: enabled && (latest?.attempt !== attempt || isLoadingWiderFeed),
    isRefreshing: enabled && attempt > 0 && latest?.attempt !== attempt,
    reload,
  };
}
