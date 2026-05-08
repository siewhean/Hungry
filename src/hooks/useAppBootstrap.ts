import { useEffect, useRef } from "react";

import { setAnalyticsSink, trackAnalyticsEvent } from "@/lib/analytics";
import { posthogSink } from "@/lib/analytics/posthogSink";
import { getConfiguredDataSource, getSupabaseClient } from "@/lib/services/supabase/client";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";

export function useAppBootstrap() {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const syncProfile = useProfileStore((state) => state.syncProfile);
  const applyProfile = useProfileStore((state) => state.applyProfile);
  const applyAuthStateFromSession = useSessionStore((state) => state.applyAuthStateFromSession);
  const markAuthReady = useSessionStore((state) => state.markAuthReady);
  const setOffline = useUIStore((state) => state.setOffline);
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
    // Keep bootstrap deterministic in local/dev runs.
    // This avoids hard runtime dependency on optional NetInfo wiring.
    setOffline(false);
  }, [setOffline]);

  useEffect(() => {
    if (getConfiguredDataSource() !== "supabase") {
      markAuthReady();
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      applyAuthStateFromSession({ isAuthenticated: false });
      return;
    }

    let active = true;

    void client.auth
      .getSession()
      .then(async ({ data }) => {
        if (!active) return;
        const user = data.session?.user;
        applyAuthStateFromSession({
          isAuthenticated: Boolean(user),
          userId: user?.id ?? null,
        });
        if (user) {
          const profile = await getHungryService().profile.getProfile();
          if (!active) return;
          applyProfile(profile);
        }
      })
      .catch(() => {
        if (!active) return;
        // Network failures during bootstrap should not crash the app.
        // Fall back to signed-out state and let auth screens retry explicitly.
        applyAuthStateFromSession({
          isAuthenticated: false,
          userId: null,
        });
      });

    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      applyAuthStateFromSession({
        isAuthenticated: Boolean(user),
        userId: user?.id ?? null,
      });
      if (!user) return;
      void getHungryService()
        .profile.getProfile()
        .then((profile) => {
          if (active) applyProfile(profile);
        })
        .catch(() => undefined);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [applyAuthStateFromSession, applyProfile, markAuthReady]);

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
