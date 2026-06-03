export const WEBSITE_PREFETCH_ROUTES = [
  "/",
  "/for-foodies",
  "/for-merchants",
  "/join-waitlist",
  "/privacy",
  "/terms",
  "/account/delete",
] as const;

export const PREFETCH_EXCLUDED_PREFIXES = [
  "/console",
  "/merchant",
  "/admin",
  "/account/settings",
  "/account/profile",
] as const;

export const PREFETCH_ROUTE_STATS: {
  attempts: number;
  hits: number;
  misses: number;
  errors: number;
  routeStats: Record<
    string,
    {
      attempts: number;
      hits: number;
      misses: number;
      errors: number;
      totalDurationMs: number;
      sampleCount: number;
    }
  >;
} = {
  attempts: 0,
  hits: 0,
  misses: 0,
  errors: 0,
  routeStats: {},
};

export const PREFETCH_ROUTE_SET = new Set<string>(WEBSITE_PREFETCH_ROUTES);

function normalizePath(pathname?: string | null) {
  if (!pathname) {
    return undefined;
  }

  if (!pathname.startsWith("/")) {
    return undefined;
  }

  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function getOrCreateRouteStat(pathname: string) {
  if (!PREFETCH_ROUTE_STATS.routeStats[pathname]) {
    PREFETCH_ROUTE_STATS.routeStats[pathname] = {
      attempts: 0,
      hits: 0,
      misses: 0,
      errors: 0,
      totalDurationMs: 0,
      sampleCount: 0,
    };
  }

  return PREFETCH_ROUTE_STATS.routeStats[pathname];
}

export function shouldPrefetchRoute(pathname?: string | null) {
  const normalizedPath = normalizePath(pathname);
  if (!normalizedPath) {
    return false;
  }

  if (!PREFETCH_ROUTE_SET.has(normalizedPath)) {
    return false;
  }

  return true;
}

export function shouldSkipRoutePrefetch(pathname?: string | null) {
  const normalizedPath = normalizePath(pathname);
  if (!normalizedPath) return true;

  if (normalizedPath === "/account/delete") {
    return false;
  }

  if (normalizedPath === "/join-waitlist") {
    return true;
  }

  return PREFETCH_EXCLUDED_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix));
}

export function recordPrefetchHit() {
  PREFETCH_ROUTE_STATS.hits += 1;
}

export function recordPrefetchMiss() {
  PREFETCH_ROUTE_STATS.misses += 1;
}

export function recordPrefetchAttempt() {
  PREFETCH_ROUTE_STATS.attempts += 1;
}

export function recordPrefetchRouteAttempt(pathname: string) {
  const normalized = normalizePath(pathname) ?? pathname;
  getOrCreateRouteStat(normalized).attempts += 1;
}

export function recordPrefetchRouteHit(pathname: string) {
  const normalized = normalizePath(pathname) ?? pathname;
  getOrCreateRouteStat(normalized).hits += 1;
}

export function recordPrefetchRouteMiss(pathname: string) {
  const normalized = normalizePath(pathname) ?? pathname;
  getOrCreateRouteStat(normalized).misses += 1;
}

export function recordPrefetchRouteError(pathname: string) {
  const normalized = normalizePath(pathname) ?? pathname;
  PREFETCH_ROUTE_STATS.errors += 1;
  getOrCreateRouteStat(normalized).errors += 1;
}

export function recordPrefetchRouteComplete(pathname: string, durationMs: number) {
  const normalized = normalizePath(pathname) ?? pathname;
  const routeStat = getOrCreateRouteStat(normalized);
  routeStat.totalDurationMs += durationMs;
  routeStat.sampleCount += 1;
}

export function getPrefetchStats() {
  return {
    attempts: PREFETCH_ROUTE_STATS.attempts,
    hits: PREFETCH_ROUTE_STATS.hits,
    misses: PREFETCH_ROUTE_STATS.misses,
    errors: PREFETCH_ROUTE_STATS.errors,
    routeStats: PREFETCH_ROUTE_STATS.routeStats,
  };
}
