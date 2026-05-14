import { useEffect, useRef } from "react";
import { setAnalyticsSink, trackAnalyticsEvent } from "@/lib/analytics";
import { getConfiguredDataSource, getSupabaseClient } from "@/lib/services/supabase/client";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import type { UserProfile } from "@/types/domain";

function shouldEnablePostHogSink() {
  return (
    process.env.EXPO_PUBLIC_DISABLE_POSTHOG !== "1" &&
    Boolean(process.env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim())
  );
}

function getProfileStoreState() {
  const { useProfileStore } =
    require("@/store/useProfileStore") as typeof import("@/store/useProfileStore");
  return useProfileStore.getState();
}

function applyProfile(profile: UserProfile) {
  getProfileStoreState().applyProfile(profile);
}

function syncProfile(isAuthenticated: boolean) {
  getProfileStoreState().syncProfile(isAuthenticated);
}

type BrowserIdleHandle = number;

function runAfterIdle(callback: () => void) {
  const requestIdle = globalThis.requestIdleCallback ?? null;
  if (typeof requestIdle === "function") {
    const handle = requestIdle(callback) as BrowserIdleHandle;
    const cancel = globalThis.cancelIdleCallback;
    return () => {
      if (typeof cancel === "function") {
        cancel(handle);
      }
    };
  }

  const timeout = setTimeout(callback, 0);
  return () => clearTimeout(timeout);
}

export function useAppBootstrap() {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
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

    hasConfiguredAnalyticsSink.current = true;

    const cancelTask = runAfterIdle(() => {
      if (!shouldEnablePostHogSink()) {
        return;
      }

      const { posthogSink } =
        require("@/lib/analytics/posthogSink") as typeof import("@/lib/analytics/posthogSink");
      setAnalyticsSink(posthogSink);
    });

    return cancelTask;
  }, []);

  useEffect(() => {
    if (hasTrackedLaunch.current) {
      return;
    }
    hasTrackedLaunch.current = true;

    const cancelTask = runAfterIdle(() => {
      trackAnalyticsEvent("app_launched", {
        is_authenticated: isAuthenticated,
      });
    });

    return cancelTask;
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
          try {
            const profile = await getHungryService().profile.getProfile();
            if (!active) return;
            applyProfile(profile);
          } catch {
            // Keep the restored auth session even if profile hydration needs to retry later.
          }
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
  }, [applyAuthStateFromSession, markAuthReady]);

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
  }, [isAuthenticated]);
}
