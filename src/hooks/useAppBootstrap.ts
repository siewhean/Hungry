import NetInfo from "@react-native-community/netinfo";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { hydrateShareAttribution } from "@/features/share/shareAttribution";
import { setAnalyticsSink, trackAnalyticsEvent } from "@/lib/analytics";
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
import { isNetworkOffline } from "@/lib/network/connectivity";
import { useLocationStore } from "@/store/useLocationStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useMerchantStore } from "@/store/useMerchantStore";
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

function syncProfile(isAuthenticated: boolean, userId?: string | null) {
  getProfileStoreState().syncProfile(isAuthenticated, userId);
}

type BrowserIdleHandle = number;
type ApplyAuthStateFromSession = ReturnType<
  typeof useSessionStore.getState
>["applyAuthStateFromSession"];

function isUuidLikeAuthUserId(value?: string | null): value is string {
  return Boolean(
    value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  );
}

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

function shouldWarmLegacyRepositoryCache() {
  return process.env.EXPO_PUBLIC_HUNGRY_LEGACY_CACHE_WARMUP === "1";
}

// supabase-js reports a refresh that failed for network reasons as
// AuthRetryableFetchError (status 0). Only then is "no session" not final.
function isRetryableAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { name, status } = error as { name?: unknown; status?: unknown };
  return name === "AuthRetryableFetchError" || status === 0;
}

function preserveRestoredAuthState(applyAuthStateFromSession: ApplyAuthStateFromSession): boolean {
  const restoredSession = useSessionStore.getState();
  const userId = restoredSession.authenticatedUserId;
  const isValidUuid = isUuidLikeAuthUserId(userId);

  if (restoredSession.isAuthenticated && restoredSession.authenticatedUserId && isValidUuid) {
    applyAuthStateFromSession({
      isAuthenticated: true,
      userId: restoredSession.authenticatedUserId,
    });
    return true;
  }

  return false;
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
    // Re-read GPS on launch and on each return to the foreground; the store
    // skips it unless permission is granted and the last fix is stale.
    const refreshLocation = () => {
      void useLocationStore.getState().refreshLocation();
    };
    // The persisted permission must be restored before the launch check.
    let unsubscribeHydration: (() => void) | undefined;
    if (useLocationStore.persist.hasHydrated()) {
      refreshLocation();
    } else {
      unsubscribeHydration = useLocationStore.persist.onFinishHydration(refreshLocation);
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
      // `null` means the native reachability probe has not resolved yet; do
      // not show an offline screen until connectivity is known to be absent.
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

      if (restoredMockSession) {
        setMockServiceProvider();
      }
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

    // Supabase-configured user mode uses live data instead of prior mock sessions.
    const hasValidSupabaseAuth = isAuthenticated && isUuidLikeAuthUserId(authenticatedUserId);
    setConfiguredDataSource("supabase");
    setSupabaseServiceProvider();
    if (isAuthenticated && !hasValidSupabaseAuth) {
      applyAuthStateFromSession({ isAuthenticated: false });
    }

    // Ensure profile surface resolves against Supabase data immediately after
    // provider swap, so user-mode entry screens do not briefly render
    // legacy mock profiles.
    syncProfile(hasValidSupabaseAuth, authenticatedUserId);

    // Discovery/detail routes hydrate through bounded RPCs. The legacy cache
    // loads the whole catalog, so it is opt-in for diagnostics only and never
    // starts work on the interactive application shell by default.
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
    if (!hasHydrated) {
      return;
    }

    if (getConfiguredDataSource() !== "supabase") {
      markAuthReady();
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      applyAuthStateFromSession({ isAuthenticated: false });
      markAuthReady();
      return;
    }

    let active = true;

    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        const user = data.session?.user;
        if (!user) {
          // No session is final (expired or revoked) unless the refresh only
          // failed for network reasons; otherwise a stale local session would
          // look signed in while every write fails.
          if (isRetryableAuthError(error) && preserveRestoredAuthState(applyAuthStateFromSession)) {
            return;
          }
          applyAuthStateFromSession({ isAuthenticated: false, userId: null });
          return;
        }

        applyAuthStateFromSession({
          isAuthenticated: true,
          userId: user.id,
        });
        const cancelProfileHydration = runAfterIdle(() => {
          void getHungryService()
            .profile.getProfile()
            .then((profile) => {
              if (active) applyProfile(profile);
            })
            .catch(() => undefined);
        });
        if (!active) cancelProfileHydration();
      })
      .catch(() => {
        if (!active) return;
        // Network/storage failures during bootstrap should not force a logout
        // when a prior local session was already restored. The next successful
        // auth event will reconcile Supabase state; explicit sign-out still
        // clears both Supabase tokens and the local session store.
        if (preserveRestoredAuthState(applyAuthStateFromSession)) {
          return;
        }

        applyAuthStateFromSession({
          isAuthenticated: false,
          userId: null,
        });
      });

    const { data: subscription } = client.auth.onAuthStateChange((event, session) => {
      const user = session?.user;
      if (!user) {
        // getSession() above settles the startup session (and keeps it on a
        // network failure); any later null session means signed out.
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
      // Interactive sign-in already applies the session profile (and may be
      // merging guest preferences). Do not race that merge with a second
      // stale server read; cold-session restoration above hydrates once idle.
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

    // Keep persisted profile customisations on cold start.
    // Only resync base profile when auth state actually changes.
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

    if (!profileNeedsRepair && previousAuth.current === isAuthenticated) {
      return;
    }

    syncProfile(isAuthenticated, authenticatedUserId);
    previousAuth.current = isAuthenticated;
  }, [authenticatedUserId, isAuthenticated]);

  return isDataSourceReady;
}
