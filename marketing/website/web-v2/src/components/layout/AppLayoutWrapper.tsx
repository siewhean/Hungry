"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import AnnouncementBar from "@/components/layout/AnnouncementBar";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import {
  WEBSITE_PREFETCH_ROUTES,
  recordPrefetchAttempt,
  recordPrefetchHit,
  recordPrefetchMiss,
  recordPrefetchRouteAttempt,
  recordPrefetchRouteComplete,
  recordPrefetchRouteError,
  recordPrefetchRouteHit,
  recordPrefetchRouteMiss,
  getPrefetchStats,
  shouldPrefetchRoute,
  shouldSkipRoutePrefetch,
} from "@/lib/performance/prefetch";

const prefetchedRoutes = new Set<string>();
let prefetchBootstrapped = false;

export default function AppLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isSpecialConsole = pathname?.startsWith("/console") || pathname?.startsWith("/merchant");
  const previousPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    const currentPathname = pathname ?? null;
    if (previousPathnameRef.current !== null && previousPathnameRef.current !== currentPathname) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
    previousPathnameRef.current = currentPathname;
  }, [pathname]);

  useEffect(() => {
    if (prefetchBootstrapped || !shouldPrefetchRoute(pathname)) {
      return;
    }

    if (shouldSkipRoutePrefetch(pathname)) {
      return;
    }

    const prefetchRoutes = () => {
      prefetchBootstrapped = true;

      WEBSITE_PREFETCH_ROUTES.forEach((route) => {
        if (prefetchedRoutes.has(route)) {
          if (process.env.NODE_ENV === "development") {
            recordPrefetchHit();
            recordPrefetchRouteHit(route);
          }
          return;
        }

        if (process.env.NODE_ENV === "development") {
          recordPrefetchMiss();
          recordPrefetchRouteMiss(route);
          console.debug(`[Performance] Prefetch warm: ${route}`);
        }

        prefetchedRoutes.add(route);
        recordPrefetchAttempt();
        recordPrefetchRouteAttempt(route);

        const start = globalThis.performance?.now() ?? Date.now();
        if (typeof router.prefetch === "function") {
          let prefetchResult: unknown;
          try {
            prefetchResult = router.prefetch(route);
          } catch {
            recordPrefetchRouteError(route);
            if (process.env.NODE_ENV === "development") {
              console.debug(`[Performance] Prefetch skipped: ${route}`);
            }
            return;
          }

          Promise.resolve(prefetchResult)
            .then(() => {
              const duration = Math.round((globalThis.performance?.now() ?? Date.now()) - start);
              recordPrefetchRouteComplete(route, duration);
            })
            .catch(() => {
              recordPrefetchRouteError(route);
              // Safe ignore: prefetch is opportunistic.
              if (process.env.NODE_ENV === "development") {
                console.debug(`[Performance] Prefetch skipped: ${route}`);
              }
            });
        } else if (process.env.NODE_ENV === "development") {
          console.debug(`[Performance] Prefetch unavailable for route: ${route}`);
        }
      });

      if (process.env.NODE_ENV === "development") {
        const stats = getPrefetchStats();
        (window as unknown as { __hungryWebsitePrefetch?: unknown }).__hungryWebsitePrefetch = {
          ...stats,
          routeStats: stats.routeStats,
        };
        console.debug(`[Performance] Prefetch stats`, stats);
      }
    };

    const doPrefetch = () => {
      if (typeof window.requestIdleCallback === "function") {
        const handle = window.requestIdleCallback(() => {
          prefetchRoutes();
        });
        return () => window.cancelIdleCallback(handle);
      }

      const timer = window.setTimeout(prefetchRoutes, 200);
      return () => window.clearTimeout(timer);
    };

    return doPrefetch();
  }, [pathname, router]);

  if (isSpecialConsole) {
    return <>{children}</>;
  }

  return (
    <>
      <AnnouncementBar />
      <Navbar />
      {children}
      <Footer />
    </>
  );
}
