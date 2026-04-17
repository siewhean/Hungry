import { useEffect, useRef } from "react";
import NetInfo from "@react-native-community/netinfo";

import { setAnalyticsSink, trackAnalyticsEvent } from "@/lib/analytics";
import { posthogSink } from "@/lib/analytics/posthogSink";
import { getConfiguredDataSource, getSupabaseClient } from "@/lib/services/supabase/client";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";

export function useAppBootstrap() {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const syncProfile = useProfileStore((state) => state.syncProfile);
  const applyAuthStateFromSession = useSessionStore((state) => state.applyAuthStateFromSession);
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
    const toOffline = (isConnected: boolean | null, isInternetReachable: boolean | null) =>
      !isConnected || isInternetReachable === false;

    const unsubscribe = NetInfo.addEventListener((state) => {
      setOffline(toOffline(state.isConnected, state.isInternetReachable ?? null));
    });

    void NetInfo.fetch().then((state) => {
      setOffline(toOffline(state.isConnected, state.isInternetReachable ?? null));
    });

    return unsubscribe;
  }, [setOffline]);

  useEffect(() => {
    if (getConfiguredDataSource() !== "supabase") {
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      applyAuthStateFromSession({ isAuthenticated: false });
      return;
    }

    let active = true;

    void client.auth.getSession().then(({ data }) => {
      if (!active) return;
      const user = data.session?.user;
      applyAuthStateFromSession({
        isAuthenticated: Boolean(user),
        userId: user?.id ?? null,
      });
    });

    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      applyAuthStateFromSession({
        isAuthenticated: Boolean(user),
        userId: user?.id ?? null,
      });
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [applyAuthStateFromSession]);

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
