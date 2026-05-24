import { create } from "zustand";
import { persist } from "zustand/middleware";

import { trackAnalyticsEvent } from "@/lib/analytics";
import type { AuthProvider } from "@/lib/services/types";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useLocationStore } from "./useLocationStore";
import { hungrySecurePersistStorage } from "./secureStorage";

export interface PendingRoute {
  name: string;
  params?: Record<string, unknown>;
}

interface SessionState {
  hasHydrated: boolean;
  isAuthReady: boolean;
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  hasSkippedTasteQuiz: boolean;
  authenticatedUserId?: string | null;
  returnRoute?: string | PendingRoute;
  sessionExpired: boolean;
  completeAuth: (options?: {
    completedOnboarding?: boolean;
    skippedTasteQuiz?: boolean;
    authProvider?: AuthProvider;
    trackSignInEvent?: boolean;
  }) => void;
  completeOnboarding: (skippedQuiz?: boolean) => void;
  expireSession: () => void;
  dismissSessionExpiry: () => void;
  setReturnRoute: (route?: string | PendingRoute) => void;
  setSkippedTasteQuiz: (skipped: boolean) => void;
  signOut: () => void;
  clearSession: () => void;
  markHydrated: () => void;
  markAuthReady: () => void;
  applyAuthStateFromSession: (session: {
    isAuthenticated: boolean;
    userId?: string | null;
    completedOnboarding?: boolean;
    skippedTasteQuiz?: boolean;
  }) => void;
}

const initialState = {
  hasHydrated: false,
  isAuthReady: false,
  isAuthenticated: false,
  hasCompletedOnboarding: false,
  hasSkippedTasteQuiz: false,
  authenticatedUserId: null,
  returnRoute: undefined,
  sessionExpired: false,
} as const;

function getProfileStoreState() {
  const { useProfileStore } = require("./useProfileStore") as typeof import("./useProfileStore");
  return useProfileStore.getState();
}

function getMerchantStoreState() {
  const { useMerchantStore } = require("./useMerchantStore") as typeof import("./useMerchantStore");
  return useMerchantStore.getState();
}

function getSafeProfileId(): string {
  return getProfileStoreState().profile?.id ?? "guest-user";
}

function isUuidLike(value?: string | null): value is string {
  return Boolean(
    value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  );
}

function getAuthenticatedProfileId(): string | null {
  const profileId = getProfileStoreState().profile?.id ?? null;
  if (getConfiguredDataSource() === "supabase") {
    return isUuidLike(profileId) ? profileId : null;
  }
  return profileId;
}

function syncProfileForAuthState(isAuthenticated: boolean, userId?: string | null): void {
  if (getConfiguredDataSource() === "supabase" && isAuthenticated && !userId) {
    return;
  }
  getProfileStoreState().syncProfile(isAuthenticated, userId);
}

function clearAccountScopedStores(): void {
  getMerchantStoreState().clearMerchant();
  useLocationStore.getState().resetLocationState();
}

function shouldEnablePostHogIdentity() {
  return (
    process.env.EXPO_PUBLIC_DISABLE_POSTHOG !== "1" &&
    Boolean(process.env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim())
  );
}

function identifyPostHogUser(userId: string, properties: Record<string, unknown>): void {
  if (!shouldEnablePostHogIdentity()) {
    return;
  }

  const { identifyPostHogUser: identify } =
    require("@/lib/analytics/posthogSink") as typeof import("@/lib/analytics/posthogSink");
  identify(userId, properties);
}

function resetPostHogUser(): void {
  if (!shouldEnablePostHogIdentity()) {
    return;
  }

  const { resetPostHogUser: reset } =
    require("@/lib/analytics/posthogSink") as typeof import("@/lib/analytics/posthogSink");
  reset();
}

function buildPostHogIdentityProperties() {
  const profile = getProfileStoreState().profile;
  const location = useLocationStore.getState();
  return {
    has_taste_profile: Boolean(profile?.tasteVector),
    dietary_preference_count: profile?.dietaryPreferences?.length ?? 0,
    location_source: location.manualLocation ? "manual" : location.permission,
    latitude: location.currentLocation.latitude,
    longitude: location.currentLocation.longitude,
  };
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      ...initialState,
      completeAuth: (options) => {
        const nextUserId = getAuthenticatedProfileId();
        const isSupabaseMode = getConfiguredDataSource() === "supabase";
        const shouldAuthenticate = !isSupabaseMode || Boolean(nextUserId);
        const previousUserId = useSessionStore.getState().authenticatedUserId;
        if (previousUserId && nextUserId && previousUserId !== nextUserId) {
          clearAccountScopedStores();
        }
        set((state) => ({
          isAuthReady: true,
          isAuthenticated: shouldAuthenticate,
          authenticatedUserId: shouldAuthenticate ? nextUserId : null,
          hasCompletedOnboarding: options?.completedOnboarding ?? state.hasCompletedOnboarding,
          hasSkippedTasteQuiz: options?.skippedTasteQuiz ?? state.hasSkippedTasteQuiz,
          sessionExpired: false,
        }));
        syncProfileForAuthState(shouldAuthenticate, nextUserId);
        if (!shouldAuthenticate) {
          return;
        }
        const syncedProfile = getProfileStoreState().profile;
        const profileId = syncedProfile?.id ?? "guest-user";
        identifyPostHogUser(profileId, buildPostHogIdentityProperties());
        if (shouldAuthenticate && (options?.trackSignInEvent ?? true)) {
          trackAnalyticsEvent(
            "sign_in_completed",
            {
              method: options?.authProvider ?? "email",
              has_completed_onboarding: options?.completedOnboarding ?? false,
              skipped_taste_quiz: options?.skippedTasteQuiz ?? false,
            },
            { userId: profileId },
          );
        }
      },
      completeOnboarding: (skippedQuiz = false) => {
        set({
          hasCompletedOnboarding: true,
          hasSkippedTasteQuiz: skippedQuiz,
        });
        trackAnalyticsEvent("onboarding_completed", {
          skipped_quiz: skippedQuiz,
        });
      },
      expireSession: () => {
        const profileId = getSafeProfileId();
        set({ sessionExpired: true, isAuthenticated: false });
        clearAccountScopedStores();
        resetPostHogUser();
        trackAnalyticsEvent("sign_out", { reason: "session_expired" }, { userId: profileId });
      },
      dismissSessionExpiry: () => set({ sessionExpired: false }),
      setReturnRoute: (returnRoute) => set({ returnRoute }),
      setSkippedTasteQuiz: (hasSkippedTasteQuiz) => set({ hasSkippedTasteQuiz }),
      signOut: () => {
        const profileId = getSafeProfileId();
        if (getConfiguredDataSource() === "supabase") {
          void getHungryService()
            .auth.signOut()
            .catch(() => undefined);
        }
        set({ ...initialState, isAuthReady: true });
        clearAccountScopedStores();
        getProfileStoreState().clearProfile();
        getProfileStoreState().syncProfile(false);
        resetPostHogUser();
        trackAnalyticsEvent("sign_out", { reason: "manual" }, { userId: profileId });
      },
      clearSession: () => {
        const profileId = getSafeProfileId();
        set({ ...initialState, isAuthReady: true });
        clearAccountScopedStores();
        getProfileStoreState().clearProfile();
        getProfileStoreState().syncProfile(false);
        resetPostHogUser();
        trackAnalyticsEvent("sign_out", { reason: "clear_session" }, { userId: profileId });
      },
      markHydrated: () => set({ hasHydrated: true }),
      markAuthReady: () => set({ isAuthReady: true }),
      applyAuthStateFromSession: (session) => {
        const currentlyAuthenticated = useSessionStore.getState().isAuthenticated;
        const isInvalidSupabaseAuthState =
          getConfiguredDataSource() === "supabase" &&
          session.isAuthenticated &&
          !isUuidLike(session.userId);

        if (isInvalidSupabaseAuthState) {
          if (currentlyAuthenticated) {
            clearAccountScopedStores();
          }
          set({
            isAuthenticated: false,
            isAuthReady: true,
            authenticatedUserId: null,
            sessionExpired: false,
          });
          syncProfileForAuthState(false, null);
          return;
        }

        if (session.isAuthenticated) {
          const previousUserId = useSessionStore.getState().authenticatedUserId;
          const nextUserId = session.userId ?? null;
          if (previousUserId && nextUserId && previousUserId !== nextUserId) {
            clearAccountScopedStores();
          }
          set((state) => ({
            isAuthenticated: true,
            isAuthReady: true,
            authenticatedUserId: nextUserId,
            hasCompletedOnboarding: session.completedOnboarding ?? state.hasCompletedOnboarding,
            hasSkippedTasteQuiz: session.skippedTasteQuiz ?? state.hasSkippedTasteQuiz,
            sessionExpired: false,
          }));
          syncProfileForAuthState(true, session.userId);

          const profile = getProfileStoreState().profile;
          const profileId = session.userId ?? profile?.id ?? "guest-user";
          identifyPostHogUser(profileId, buildPostHogIdentityProperties());

          if (!currentlyAuthenticated) {
            trackAnalyticsEvent(
              "sign_in_completed",
              {
                method: "email",
                has_completed_onboarding: session.completedOnboarding ?? false,
                skipped_taste_quiz: session.skippedTasteQuiz ?? false,
              },
              { userId: profileId },
            );
          }
          return;
        }

        if (!currentlyAuthenticated) {
          set({ isAuthReady: true });
          return;
        }

        const profileId = getSafeProfileId();
        set({
          isAuthenticated: false,
          isAuthReady: true,
          authenticatedUserId: null,
          sessionExpired: false,
        });
        clearAccountScopedStores();
        getProfileStoreState().syncProfile(false);
        resetPostHogUser();
        trackAnalyticsEvent(
          "sign_out",
          { reason: "supabase_auth_state_change" },
          { userId: profileId },
        );
      },
    }),
    {
      name: "hungry-session-v1",
      storage: hungrySecurePersistStorage,
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        authenticatedUserId: state.authenticatedUserId,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        hasSkippedTasteQuiz: state.hasSkippedTasteQuiz,
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);
