import { create } from "zustand";
import { persist } from "zustand/middleware";

import { trackAnalyticsEvent } from "@/lib/analytics";
import type { AuthProvider } from "@/lib/services/types";
import { getConfiguredDataSource, type HungryDataSource } from "@/lib/services/supabase/client";
import { getHungryService } from "@/lib/services/serviceProvider";
import { scheduleIdleWork } from "@/lib/performance/scheduleIdleWork";
import { useLocationStore } from "./useLocationStore";
import { hungryPersistStorage } from "./persistStorage";

export interface PendingRoute {
  name: string;
  params?: Record<string, unknown>;
}

export interface AuthNotice {
  message: string;
  tone: "info" | "success" | "warning" | "error";
}

export const SESSION_EXPIRED_NOTICE: AuthNotice = {
  message: "Your session expired. Sign in again to continue.",
  tone: "warning",
};

interface SessionState {
  hasHydrated: boolean;
  isAuthReady: boolean;
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  hasSkippedTasteQuiz: boolean;
  authenticatedUserId?: string | null;
  authDataSource?: HungryDataSource | null;
  returnRoute?: string | PendingRoute;
  sessionExpired: boolean;
  /**
   * True while a password-recovery code exchange + password update is running.
   * The exchange emits SIGNED_IN/PASSWORD_RECOVERY; AppBody holds the current
   * navigator while this is set so the reset form is not unmounted mid-flow.
   * Never persisted.
   */
  passwordRecoveryInProgress: boolean;
  /** One-shot message shown on the Login screen after a signed-out transition. */
  authNotice?: AuthNotice | null;
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
  beginPasswordRecovery: () => void;
  endPasswordRecovery: () => void;
  setAuthNotice: (notice: AuthNotice | null) => void;
  /** Returns the pending sign-in notice (session expiry first) and clears it. */
  consumeAuthNotice: () => AuthNotice | null;
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
  authDataSource: null,
  returnRoute: undefined,
  sessionExpired: false,
  passwordRecoveryInProgress: false,
  authNotice: null,
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
  return getProfileStoreState().profile?.id ?? "anonymous-session";
}

function isUuidLike(value?: string | null): value is string {
  return Boolean(
    value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
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
  const { useSocialStore } = require("./useSocialStore") as typeof import("./useSocialStore");
  const { useActivityStore } = require("./useActivityStore") as typeof import("./useActivityStore");
  const { usePublishedPostStore } =
    require("./usePublishedPostStore") as typeof import("./usePublishedPostStore");
  const { useStallInteractionStore } =
    require("./useStallInteractionStore") as typeof import("./useStallInteractionStore");
  useSocialStore.getState().clearAccountScopedState();
  useActivityStore.getState().clearAccountScopedState();
  usePublishedPostStore.getState().clearPosts();
  useStallInteractionStore.getState()._reset();
  const { useStallFollowStore } =
    require("./useStallFollowStore") as typeof import("./useStallFollowStore");
  useStallFollowStore.getState()._reset();
  // Search history and review drafts are account-scoped too: every sign-out
  // path (Settings, Profile tab, merchant, expiry, account switch) clears them.
  const { useSearchStore } = require("./useSearchStore") as typeof import("./useSearchStore");
  const { useReviewDraftStore } =
    require("./useReviewDraftStore") as typeof import("./useReviewDraftStore");
  useSearchStore.getState().clearSearchState();
  useReviewDraftStore.getState().resetDraft();
}

function clearAuthenticatedProfile(): void {
  getProfileStoreState().clearProfile();
  getProfileStoreState().syncProfile(false);
}

function shouldEnablePostHogIdentity() {
  return (
    process.env.EXPO_PUBLIC_DISABLE_POSTHOG !== "1" &&
    Boolean(process.env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim())
  );
}

function identifyPostHogUser(userId: string, properties: Record<string, unknown>): void {
  if (!shouldEnablePostHogIdentity()) return;
  const { identifyPostHogUser: identify } =
    require("@/lib/analytics/posthogSink") as typeof import("@/lib/analytics/posthogSink");
  identify(userId, properties);
}

function resetPostHogUser(): void {
  if (!shouldEnablePostHogIdentity()) return;
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
    // currentLocation always holds a value (a default or a manual pick), so
    // only a granted GPS permission means the location is precise.
    has_precise_location: location.permission === "granted",
  };
}

// Interactive sign-in calls completeAuth while Supabase also emits SIGNED_IN to
// applyAuthStateFromSession; whichever runs first logs sign_in_completed.
let signInTrackedForUserId: string | null = null;

function trackSignInCompletedOnce(
  profileId: string,
  properties: { method: string; has_completed_onboarding: boolean; skipped_taste_quiz: boolean },
): void {
  if (signInTrackedForUserId === profileId) {
    return;
  }
  signInTrackedForUserId = profileId;
  trackAnalyticsEvent("sign_in_completed", properties, { userId: profileId });
}

function resetSignInTracking(): void {
  signInTrackedForUserId = null;
}

const PUSH_TOKEN_UNBIND_TIMEOUT_MS = 3000;

// Unbind this device's push token while the session can still authorize it,
// then end the Supabase session. A slow or failed unbind never blocks sign-out.
function signOutOfSupabase(): void {
  const service = getHungryService();
  const unbind = service.push.unregisterPushToken().catch(() => undefined);
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, PUSH_TOKEN_UNBIND_TIMEOUT_MS));
  void Promise.race([unbind, timeout])
    .then(() => service.auth.signOut())
    .catch(() => undefined);
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      ...initialState,
      completeAuth: (options) => {
        const authDataSource = getConfiguredDataSource();
        const nextUserId = getAuthenticatedProfileId();
        const isSupabaseMode = authDataSource === "supabase";
        const shouldAuthenticate = !isSupabaseMode || Boolean(nextUserId);
        const previousUserId = useSessionStore.getState().authenticatedUserId;
        if (previousUserId && nextUserId && previousUserId !== nextUserId) {
          clearAccountScopedStores();
        }
        set((state) => ({
          isAuthReady: true,
          isAuthenticated: shouldAuthenticate,
          authenticatedUserId: shouldAuthenticate ? nextUserId : null,
          authDataSource: shouldAuthenticate ? authDataSource : null,
          // Onboarding finished on this device (e.g. as a guest) stays done after sign-in.
          hasCompletedOnboarding:
            state.hasCompletedOnboarding || (options?.completedOnboarding ?? false),
          hasSkippedTasteQuiz: options?.skippedTasteQuiz ?? state.hasSkippedTasteQuiz,
          sessionExpired: false,
        }));
        syncProfileForAuthState(shouldAuthenticate, nextUserId);
        if (!shouldAuthenticate) return;

        const syncedProfile = getProfileStoreState().profile;
        const profileId = syncedProfile?.id ?? nextUserId ?? "authenticated-user";
        scheduleIdleWork(
          () => {
            identifyPostHogUser(profileId, buildPostHogIdentityProperties());
            if (options?.trackSignInEvent ?? true) {
              trackSignInCompletedOnce(profileId, {
                method: options?.authProvider ?? "email",
                has_completed_onboarding: options?.completedOnboarding ?? false,
                skipped_taste_quiz: options?.skippedTasteQuiz ?? false,
              });
            }
          },
          { fallbackDelayMs: 0 },
        );
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
        set({
          isAuthenticated: false,
          isAuthReady: true,
          authenticatedUserId: null,
          authDataSource: null,
          returnRoute: undefined,
          sessionExpired: true,
        });
        clearAccountScopedStores();
        clearAuthenticatedProfile();
        resetPostHogUser();
        resetSignInTracking();
        trackAnalyticsEvent("sign_out", { reason: "session_expired" }, { userId: profileId });
      },
      dismissSessionExpiry: () => set({ sessionExpired: false }),
      setReturnRoute: (returnRoute) => set({ returnRoute }),
      beginPasswordRecovery: () => set({ passwordRecoveryInProgress: true }),
      endPasswordRecovery: () => set({ passwordRecoveryInProgress: false }),
      setAuthNotice: (authNotice) => set({ authNotice }),
      consumeAuthNotice: (): AuthNotice | null => {
        const { sessionExpired, authNotice }: SessionState = useSessionStore.getState();
        const notice = sessionExpired ? SESSION_EXPIRED_NOTICE : (authNotice ?? null);
        if (sessionExpired || authNotice) set({ sessionExpired: false, authNotice: null });
        return notice;
      },
      setSkippedTasteQuiz: (hasSkippedTasteQuiz) => set({ hasSkippedTasteQuiz }),
      signOut: () => {
        const profileId = getSafeProfileId();
        const { hasCompletedOnboarding, hasSkippedTasteQuiz, authNotice }: SessionState =
          useSessionStore.getState();
        if (getConfiguredDataSource() === "supabase") {
          signOutOfSupabase();
        }
        set({
          ...initialState,
          isAuthReady: true,
          hasCompletedOnboarding,
          hasSkippedTasteQuiz,
          authNotice,
        });
        clearAccountScopedStores();
        clearAuthenticatedProfile();
        resetPostHogUser();
        resetSignInTracking();
        trackAnalyticsEvent("sign_out", { reason: "manual" }, { userId: profileId });
      },
      clearSession: () => {
        const profileId = getSafeProfileId();
        const { hasCompletedOnboarding, hasSkippedTasteQuiz } = useSessionStore.getState();
        set({
          ...initialState,
          isAuthReady: true,
          hasCompletedOnboarding,
          hasSkippedTasteQuiz,
        });
        clearAccountScopedStores();
        clearAuthenticatedProfile();
        resetPostHogUser();
        resetSignInTracking();
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
          if (currentlyAuthenticated) clearAccountScopedStores();
          set({
            isAuthenticated: false,
            isAuthReady: true,
            authenticatedUserId: null,
            authDataSource: null,
            returnRoute: undefined,
            sessionExpired: true,
          });
          clearAuthenticatedProfile();
          resetPostHogUser();
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
            authDataSource: getConfiguredDataSource(),
            hasCompletedOnboarding:
              state.hasCompletedOnboarding || (session.completedOnboarding ?? false),
            hasSkippedTasteQuiz: session.skippedTasteQuiz ?? state.hasSkippedTasteQuiz,
            sessionExpired: false,
          }));
          syncProfileForAuthState(true, session.userId);

          const profile = getProfileStoreState().profile;
          const profileId = session.userId ?? profile?.id ?? "authenticated-user";
          scheduleIdleWork(
            () => {
              identifyPostHogUser(profileId, buildPostHogIdentityProperties());
              if (!currentlyAuthenticated) {
                trackSignInCompletedOnce(profileId, {
                  method: "email",
                  has_completed_onboarding: session.completedOnboarding ?? false,
                  skipped_taste_quiz: session.skippedTasteQuiz ?? false,
                });
              }
            },
            { fallbackDelayMs: 0 },
          );
          return;
        }

        const profileId = getSafeProfileId();
        // Do not reset sessionExpired here: Supabase emits SIGNED_OUT right after
        // expireSession(), and the Login screen still needs to show that notice.
        set({
          isAuthenticated: false,
          isAuthReady: true,
          authenticatedUserId: null,
          authDataSource: null,
          returnRoute: undefined,
        });
        if (currentlyAuthenticated) {
          clearAccountScopedStores();
          clearAuthenticatedProfile();
          resetPostHogUser();
          resetSignInTracking();
          trackAnalyticsEvent(
            "sign_out",
            { reason: "supabase_auth_state_change" },
            { userId: profileId },
          );
        }
      },
    }),
    {
      name: "hungry-session-v1",
      // This store persists only app-session metadata such as user id,
      // onboarding state, and data source. Supabase refresh/access tokens stay
      // in the dedicated SecureStore-backed auth adapter.
      storage: hungryPersistStorage,
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        authenticatedUserId: state.authenticatedUserId,
        authDataSource: state.authDataSource,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        hasSkippedTasteQuiz: state.hasSkippedTasteQuiz,
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);
