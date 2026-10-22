import { getAccountGeneration as getAccountGenerationForSession } from "@/lib/security/accountScope";
import { create } from "zustand";
import { Platform } from "react-native";
import { persist } from "zustand/middleware";

import { trackAnalyticsEvent } from "@/lib/analytics";
import type { AuthProvider } from "@/lib/services/types";
import { getConfiguredDataSource, type HungryDataSource } from "@/lib/services/supabase/client";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useLocationStore } from "./useLocationStore";
import { hungryPersistStorage } from "./persistStorage";
import { scheduleIdleWork } from "@/lib/performance/scheduleIdleWork";

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
  authDataSource?: HungryDataSource | null;
  returnRoute?: string | PendingRoute;
  sessionExpired: boolean;
  completeAuth: (options?: {
    userId?: string;
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
  signOut: () => Promise<void>;
  clearSession: () => void;
  markHydrated: () => void;
  markAuthReady: () => void;
  applyAuthStateFromSession: (session: {
    isAuthenticated: boolean;
    userId?: string | null;
    completedOnboarding?: boolean;
    skippedTasteQuiz?: boolean;
  }) => void;
  passwordRecoveryInProgress: boolean;
  setPasswordRecoveryInProgress: (inProgress: boolean) => void;
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
  const { advanceAccountGeneration } =
    require("@/lib/security/accountScope") as typeof import("@/lib/security/accountScope");
  advanceAccountGeneration();
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
  const { usePortfolioStore } =
    require("./usePortfolioStore") as typeof import("./usePortfolioStore");
  const { useChecklistStore } =
    require("./useChecklistStore") as typeof import("./useChecklistStore");
  const { useCollectionStore } =
    require("./useCollectionStore") as typeof import("./useCollectionStore");
  const { useWheelStore } = require("./useWheelStore") as typeof import("./useWheelStore");
  const { useMissionStore } = require("./useMissionStore") as typeof import("./useMissionStore");
  const { usePassportStore } = require("./usePassportStore") as typeof import("./usePassportStore");
  const { useFoodCredStore } = require("./useFoodCredStore") as typeof import("./useFoodCredStore");
  const { useStoryStore } = require("./useStoryStore") as typeof import("./useStoryStore");
  const { useChatDraftStore } =
    require("./useChatDraftStore") as typeof import("./useChatDraftStore");
  const { useSearchStore } = require("./useSearchStore") as typeof import("./useSearchStore");
  const { useUIStore } = require("./useUIStore") as typeof import("./useUIStore");
  usePortfolioStore.getState()._reset();
  useChecklistStore.getState()._reset();
  useCollectionStore.getState()._reset();
  useWheelStore.getState().reset();
  useMissionStore.getState()._reset();
  usePassportStore.getState()._reset();
  useFoodCredStore.getState()._reset();
  useStoryStore.getState().clearAccountScopedState();
  useChatDraftStore.getState().clearAccountScopedState();
  useSearchStore.getState().clearSearchState();
  const { clearHomeFeedBundleCache } =
    require("@/features/home/feed") as typeof import("@/features/home/feed");
  clearHomeFeedBundleCache();
  const { useStallSubmissionStore } =
    require("./useStallSubmissionStore") as typeof import("./useStallSubmissionStore");
  const { useGamificationStore } =
    require("./useGamificationStore") as typeof import("./useGamificationStore");
  const { useDiscoveryStore } =
    require("./useDiscoveryStore") as typeof import("./useDiscoveryStore");
  useStallSubmissionStore.getState()._reset();
  useGamificationStore.getState()._reset();
  useDiscoveryStore.getState().clearAccountScopedState();
  if (getConfiguredDataSource() === "supabase") {
    const { clearSupabaseRepositoryCache } =
      require("@/lib/services/supabase/supabaseRepository") as typeof import("@/lib/services/supabase/supabaseRepository");
    clearSupabaseRepositoryCache();
  } else if (getConfiguredDataSource() === "mock") {
    const { clearMockChatAndStoryState } =
      require("@/lib/services/mock/mockService") as typeof import("@/lib/services/mock/mockService");
    clearMockChatAndStoryState();
  }

  useUIStore.setState({ toast: null, quickReview: null, reviewSuccess: null });
  const { communitySafetyState } =
    require("@/lib/security/communitySafetyState") as typeof import("@/lib/security/communitySafetyState");
  communitySafetyState.reset();
  // Native export helpers load only in the mobile runtime; pure store tests have no native modules.
  if (Platform.OS !== "web") {
    try {
      const exports =
        require("@/features/profile/shareMyDataExport") as typeof import("@/features/profile/shareMyDataExport");
      exports.cleanupMyDataExports();
    } catch {
      /* No native file runtime in a Node check. */
    }
  }
  const guest =
    require("@/features/auth/applySignedInProfile") as typeof import("@/features/auth/applySignedInProfile");
  guest.clearGuestProfileSnapshot();
  void setDraftAccountScope(null).catch(() => undefined);
  for (const key of [
    "portfolio-storage",
    "checklist-storage",
    "hungry-stories-v1",
    "hungry-chat-drafts-v1",
  ])
    void hungryPersistStorage?.removeItem(key);
}

async function setDraftAccountScope(userId: string | null, adoptGuest = false): Promise<void> {
  const { useReviewDraftStore } =
    require("./useReviewDraftStore") as typeof import("./useReviewDraftStore");
  const { useComposerStore } =
    require("@/features/post/useComposerStore") as typeof import("@/features/post/useComposerStore");
  const { useOnboardingDraftStore } =
    require("@/features/onboarding/useOnboardingDraftStore") as typeof import("@/features/onboarding/useOnboardingDraftStore");
  const { useChatDraftStore } =
    require("./useChatDraftStore") as typeof import("./useChatDraftStore");
  await Promise.all([
    useChatDraftStore.getState().setAccountScope(userId),
    useReviewDraftStore.getState().setAccountScope(userId),
    useComposerStore.getState().setAccountScope(userId),
    useOnboardingDraftStore.getState().setAccountScope(userId, { adoptGuest }),
  ]);
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

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      ...initialState,
      completeAuth: (options) => {
        const authDataSource = getConfiguredDataSource();
        const currentProfileId = getAuthenticatedProfileId();
        const nextUserId = options?.userId ?? currentProfileId;
        const isSupabaseMode = authDataSource === "supabase";
        const shouldAuthenticate =
          (!isSupabaseMode || Boolean(nextUserId)) &&
          (!options?.userId || currentProfileId === options.userId);
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
            previousUserId && previousUserId !== nextUserId
              ? (options?.completedOnboarding ?? false)
              : state.hasCompletedOnboarding || (options?.completedOnboarding ?? false),
          hasSkippedTasteQuiz: options?.skippedTasteQuiz ?? state.hasSkippedTasteQuiz,
          sessionExpired: false,
        }));
        void setDraftAccountScope(shouldAuthenticate ? nextUserId : null, !previousUserId).catch(
          () => undefined,
        );
        syncProfileForAuthState(shouldAuthenticate, nextUserId);
        if (!shouldAuthenticate) {
          return;
        }
        const syncedProfile = getProfileStoreState().profile;
        const profileId = syncedProfile?.id ?? "guest-user";
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
          sessionExpired: true,
          isAuthenticated: false,
          authenticatedUserId: null,
          authDataSource: null,
          passwordRecoveryInProgress: false,
        });
        clearAccountScopedStores();
        resetPostHogUser();
        resetSignInTracking();
        getProfileStoreState().clearProfile();
        getProfileStoreState().syncProfile(false);
        trackAnalyticsEvent("sign_out", { reason: "session_expired" }, { userId: profileId });
      },
      dismissSessionExpiry: () => set({ sessionExpired: false }),
      setReturnRoute: (returnRoute) => set({ returnRoute }),
      setSkippedTasteQuiz: (hasSkippedTasteQuiz) => set({ hasSkippedTasteQuiz }),
      setPasswordRecoveryInProgress: (passwordRecoveryInProgress) =>
        set({ passwordRecoveryInProgress }),
      signOut: async () => {
        const profileId = getSafeProfileId();
        const hasSkippedTasteQuiz = useSessionStore.getState().hasSkippedTasteQuiz;
        let signOutCleanup: Promise<void> = Promise.resolve();
        if (getConfiguredDataSource() === "supabase") {
          // The service synchronously retires the captured auth client before yielding.
          signOutCleanup = getHungryService().auth.signOut();
        }
        set({
          ...initialState,
          hasHydrated: useSessionStore.getState().hasHydrated,
          isAuthReady: true,
          hasCompletedOnboarding: true,
          hasSkippedTasteQuiz,
        });
        clearAccountScopedStores();
        getProfileStoreState().clearProfile();
        getProfileStoreState().syncProfile(false);
        resetPostHogUser();
        resetSignInTracking();
        trackAnalyticsEvent("sign_out", { reason: "manual" }, { userId: profileId });
        await signOutCleanup;
      },
      clearSession: () => {
        const profileId = getSafeProfileId();
        set({
          ...initialState,
          hasHydrated: useSessionStore.getState().hasHydrated,
          isAuthReady: true,
        });
        clearAccountScopedStores();
        getProfileStoreState().clearProfile();
        getProfileStoreState().syncProfile(false);
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
          if (currentlyAuthenticated) {
            clearAccountScopedStores();
          }
          set({
            isAuthenticated: false,
            isAuthReady: true,
            authenticatedUserId: null,
            authDataSource: null,
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
            isAuthReady: false,
            authenticatedUserId: nextUserId,
            authDataSource: getConfiguredDataSource(),
            hasCompletedOnboarding:
              previousUserId && previousUserId !== nextUserId
                ? (session.completedOnboarding ?? false)
                : state.hasCompletedOnboarding || (session.completedOnboarding ?? false),
            hasSkippedTasteQuiz: session.skippedTasteQuiz ?? state.hasSkippedTasteQuiz,
            sessionExpired: false,
          }));
          const scopeGeneration = getAccountGenerationForSession();
          void setDraftAccountScope(nextUserId, !previousUserId)
            .then(() => {
              if (
                scopeGeneration === getAccountGenerationForSession() &&
                useSessionStore.getState().authenticatedUserId === nextUserId
              )
                set({ isAuthReady: true });
            })
            .catch(() => {
              if (scopeGeneration === getAccountGenerationForSession()) {
                // Storage restoration failure must not strand the splash screen.
                set({ isAuthReady: true });
                const { useUIStore } = require("./useUIStore") as typeof import("./useUIStore");
                useUIStore.getState().showToast({
                  message:
                    "Some drafts could not be restored. Your saved account preferences are unchanged.",
                  tone: "warning",
                });
              }
            });
          syncProfileForAuthState(true, session.userId);

          const profile = getProfileStoreState().profile;
          const profileId = session.userId ?? profile?.id ?? "guest-user";
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

        if (!currentlyAuthenticated) {
          set({ isAuthReady: true });
          return;
        }

        const profileId = getSafeProfileId();
        set({
          isAuthenticated: false,
          isAuthReady: true,
          authenticatedUserId: null,
          authDataSource: null,
          sessionExpired: false,
        });
        clearAccountScopedStores();
        getProfileStoreState().syncProfile(false);
        resetPostHogUser();
        resetSignInTracking();
        trackAnalyticsEvent(
          "sign_out",
          { reason: "supabase_auth_state_change" },
          { userId: profileId },
        );
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
