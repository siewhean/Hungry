import { useEffect, useRef } from "react";

import { setAnalyticsSink, trackAnalyticsEvent } from "@/lib/analytics";
import { posthogSink } from "@/lib/analytics/posthogSink";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";

export function useAppBootstrap() {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const syncProfile = useProfileStore((state) => state.syncProfile);
  const previousAuth = useRef<boolean | undefined>(undefined);
  const hasTrackedLaunch = useRef(false);
  const hasConfiguredAnalyticsSink = useRef(false);

  useEffect(() => {
    if (hasConfiguredAnalyticsSink.current) {
      return;
    }

    setAnalyticsSink(posthogSink);
    hasConfiguredAnalyticsSink.current = true;
  }, []);

  useEffect(() => {
    if (hasTrackedLaunch.current) {
      return;
    }
    hasTrackedLaunch.current = true;
    trackAnalyticsEvent("app_launched", {
      is_authenticated: isAuthenticated,
    });
  }, [isAuthenticated]);

  useEffect(() => {
    // Keep persisted profile customisations on cold start.
    // Only resync base profile when auth state actually changes.
    if (previousAuth.current === undefined) {
      previousAuth.current = isAuthenticated;
      return;
    }

    if (previousAuth.current === isAuthenticated) {
      return;
    }

    syncProfile(isAuthenticated);
    previousAuth.current = isAuthenticated;
  }, [isAuthenticated, syncProfile]);
}
