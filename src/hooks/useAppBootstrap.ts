import NetInfo from "@react-native-community/netinfo";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { hydrateShareAttribution } from "@/features/share/shareAttribution";
import { setAnalyticsSink, trackAnalyticsEvent } from "@/lib/analytics";
import { applySignedInProfile } from "@/features/auth/applySignedInProfile";
import { isNetworkOffline } from "@/lib/network/connectivity";
import {
  getConfiguredDataSource,
  getSupabaseClient,
  setConfiguredDataSource,
} from "@/lib/services/supabase/client";
import {
  getHungryService,
  setMockServiceProvider,
  setSupabaseServiceProvider,
} from "@/lib/services/serviceProvider";
import { useLocationStore } from "@/store/useLocationStore";
import { useMerchantStore } from "@/store/useMerchantStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";

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

function syncProfile(isAuthenticated: boolean, userId?: string | null) {
  getProfileStoreState().syncProfile(isAuthenticated, userId);
}

type BrowserIdleHandle = number;

function isUuidLikeAuthUserId(value?: string | null): value is string {
  return Boolean(
    value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  );
}

function runAfterIdle(callback: () => void) {
  const requestIdle = globalThis.requestIdleCallback ?? null;
  if (typeof requestIdle === "function") {
    const handle = requestIdle(callback) as BrowserIdleHandle;
    const cancel = globalThis.cancelIdleCallback;
    return () => {
      if (typeof cancel === "function") cancel(handle);
    };
  }

  const timeout = setTimeout(callback, 0);
  return () => clearTimeout(timeout);
}

function shouldWarmLegacyRepositoryCache() {
  return process.env.EXPO_PUBLIC_HUNGRY_LEGACY_CACHE_WARMUP === "1";
}

export function useAppBootstrap() {
  const hasHydrated = useSessionStore((state) => state.hasHydrated);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const authenticatedUserId = useSessionStore((state) => state.authenticatedUserId);
  const authDataSource = useSessionStore((state) => state.authDataSource);
  const applyAuthStateFromSession = useSessionStore((state) => state.applyAuthStateFromSession);
  const markAuthReady = useSessionStore((state) => state.markAuthReady);
  const setOffline = useUIStore((state) => state.setOffline);
  const isDeveloperMode = useMerchantStore((state) => state.developerMerchantMode);
  const isMerchantMode = useMerchantStore((state) => Boolean(state.account));
  const isUserMode = !isDeveloperMode && !isMerchantMode;
  const previousAuth = useRef<boolean | undefined>(undefined);
  const [isDataSourceReady, setIsDataSourceReady] = useState(false);
  const hasTrackedLaunch = useRef(false);
  const hasConfiguredAnalyticsSink = useRef(false);

  useEffect(() => {
    if (hasConfiguredAnalyticsSink.current) return;
    hasConfiguredAnalyticsSink.current = true;

    const cancelTask = runAfterIdle(() => {
      if (!shouldEnablePostHogSink()) return;
      const { posthogSink } =
        require("@/lib/analytics/posthogSink") as typeof import("@/lib/analytics/posthogSink");
      // Send what was tracked before the sink attached (app_launched,
      // cold-start shared_link_opened) instead of dropping it.
      setAnalyticsSink(posthogSink, { replayBufferedEvents: true });
    });

    return cancelTask;
  }, []);

  useEffect(() => {
    void hydrateShareAttribution();
  }, []);

  useEffect(() => {
    // Re-read GPS on every launch and on each return to the foreground once the
    // last fix is stale; the store skips it unless permission is granted.
    const refreshLocation = () => {
      void useLocationStore.getState().refreshLocation();
    };
    const refreshLocationOnLaunch = () => {
      void useLocationStore.getState().refreshLocation({ force: true });
    };
    // The persisted permission must be restored before the launch check.
    let unsubscribeHydration: (() => void) | undefined;
    if (useLocationStore.persist.hasHydrated()) {
      refreshLocationOnLaunch();
    } else {
      unsubscribeHydration = useLocationStore.persist.onFinishHydration(refreshLocationOnLaunch);
    }
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshLocation();
    });
    return () => {
      unsubscribeHydration?.();
      subscription.remove();
    };
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
    const unsubscribe = NetInfo.addEventListener((state) => {
      // Offline is a non-blocking banner (RootNavigator OfflineBanner); the
      // current screen stays put, and authenticated catalog reads keep their
      // classified read-only Excel fallback. `null` reachability is not offline.
      setOffline(isNetworkOffline(state));
    });

    return unsubscribe;
  }, [setOffline]);

  useLayoutEffect(() => {
    if (!isUserMode) {
      setIsDataSourceReady(false);
      const restoredMockSession =
        isAuthenticated &&
        authenticatedUserId &&
        (authDataSource === "mock" ||
          (authDataSource !== "supabase" && !isUuidLikeAuthUserId(authenticatedUserId)));

      if (restoredMockSession) setMockServiceProvider();
      setIsDataSourceReady(true);
      return;
    }

    const configuredDataSource = getConfiguredDataSource();
    setIsDataSourceReady(false);

    if (configuredDataSource === "mock") {
      setMockServiceProvider();
      syncProfile(isAuthenticated, authenticatedUserId);
      setIsDataSourceReady(true);
      return;
    }

    // Released user mode is always Supabase-authenticated. Excel is exposed
    // only inside the authenticated read wrapper, never as the app provider.
    const hasValidSupabaseAuth =
      isAuthenticated && authDataSource === "supabase" && isUuidLikeAuthUserId(authenticatedUserId);
    setConfiguredDataSource("supabase");
    setSupabaseServiceProvider();
    if (isAuthenticated && !hasValidSupabaseAuth) {
      applyAuthStateFromSession({ isAuthenticated: false, userId: null });
    }

    syncProfile(hasValidSupabaseAuth, authenticatedUserId);
    setIsDataSourceReady(true);

    if (shouldWarmLegacyRepositoryCache()) {
      const cancelWarmup = runAfterIdle(() => {
        const { refreshSupabaseRepositoryCache } =
          require("@/lib/services/supabase/supabaseRepository") as typeof import("@/lib/services/supabase/supabaseRepository");
        void refreshSupabaseRepositoryCache().catch(() => undefined);
      });
      return cancelWarmup;
    }
  }, [authDataSource, applyAuthStateFromSession, authenticatedUserId, isAuthenticated, isUserMode]);

  useEffect(() => {
    if (!hasHydrated) return;

    if (getConfiguredDataSource() !== "supabase") {
      markAuthReady();
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      applyAuthStateFromSession({ isAuthenticated: false, userId: null });
      return;
    }

    let active = true;

    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) throw error;
        const user = data.session?.user;
        if (!user) {
          applyAuthStateFromSession({ isAuthenticated: false, userId: null });
          return;
        }

        // This user id came from the SecureStore-backed Supabase session, not
        // from persisted app metadata. It is therefore valid for offline catalog
        // continuity while the access token remains restored locally.
        applyAuthStateFromSession({
          isAuthenticated: true,
          userId: user.id,
        });
        const cancelProfileHydration = runAfterIdle(() => {
          void getHungryService()
            .profile.getProfile()
            .then(async (profile) => {
              if (!active) return;
              // Retry a durable provisional onboarding migration after a cold
              // restore before accepting a potentially older profile read.
              await applySignedInProfile(profile);
            })
            .catch(() => undefined);
        });
        if (!active) cancelProfileHydration();
      })
      .catch(() => {
        if (!active) return;
        // A storage/session read failure is not proof of a valid session. Fail
        // closed instead of trusting the separately persisted metadata store.
        applyAuthStateFromSession({ isAuthenticated: false, userId: null });
      });

    const { data: subscription } = client.auth.onAuthStateChange((event, session) => {
      const user = session?.user;
      if (!user) {
        // getSession() above settles the startup session; any later null
        // session means signed out.
        if (event === "INITIAL_SESSION") {
          return;
        }
        applyAuthStateFromSession({ isAuthenticated: false, userId: null });
        return;
      }

      applyAuthStateFromSession({
        isAuthenticated: true,
        userId: user.id,
      });
      // Interactive sign-in applies its session profile. Cold-session restoration
      // above performs one idle profile hydration without racing that merge.
      if (event === "TOKEN_REFRESHED") {
        // The authenticated state already carries the refreshed local session.
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [applyAuthStateFromSession, hasHydrated, markAuthReady]);

  useEffect(() => {
    const profileNeedsRepair =
      isUserMode &&
      getProfileStoreState().profile &&
      !isUuidLikeAuthUserId(getProfileStoreState().profile.id) &&
      getProfileStoreState().profile.id !== "guest-user";

    // Keep persisted profile customisations on cold start. Only resync the base
    // profile when auth state actually changes or an old fixture id is present.
    if (previousAuth.current === undefined) {
      if (profileNeedsRepair) {
        syncProfile(
          isAuthenticated && isUuidLikeAuthUserId(authenticatedUserId),
          authenticatedUserId,
        );
      }
      previousAuth.current = isAuthenticated;
      return;
    }

    if (!profileNeedsRepair && previousAuth.current === isAuthenticated) return;

    syncProfile(isAuthenticated, authenticatedUserId);
    previousAuth.current = isAuthenticated;
  }, [authenticatedUserId, isAuthenticated, isUserMode]);

  return isDataSourceReady;
}
