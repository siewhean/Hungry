import { create } from "zustand";
import { persist } from "zustand/middleware";

import { trackAnalyticsEvent } from "@/lib/analytics";
import { clearShareAttribution, getShareAttribution } from "@/features/share/shareAttribution";
import { deleteExportFile } from "@/features/profile/exportFile";
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
  /** True while a password-recovery session finishes; the auth redirect waits for it. */
  passwordRecoveryInProgress: boolean;
  /** Persisted: a sign-out whose Supabase session may still be stored on this device. */
  signOutPending: boolean;
  completeAuth: (options?: {
    completedOnboarding?: boolean;
    skippedTasteQuiz?: boolean;
    authProvider?: AuthProvider;
    trackSignInEvent?: boolean;
    /** The account was just created; logs sign_up_completed instead of sign_in_completed. */
    isNewUser?: boolean;
  }) => void;
  completeOnboarding: (skippedQuiz?: boolean) => void;
  expireSession: () => void;
  dismissSessionExpiry: () => void;
  setReturnRoute: (route?: string | PendingRoute) => void;
  setSkippedTasteQuiz: (skipped: boolean) => void;
  setPasswordRecoveryInProgress: (inProgress: boolean) => void;
  signOut: () => void;
  /** Finishes a sign-out the app was closed during; bootstrap awaits it before restoring. */
  finishPendingSignOut: () => Promise<void>;
  clearSession: () => void;
  markHydrated: () => void;
  markAuthReady: () => void;
  applyAuthStateFromSession: (session: {
    isAuthenticated: boolean;
    userId?: string | null;
    completedOnboarding?: boolean;
    skippedTasteQuiz?: boolean;
    authProvider?: string;
    isNewUser?: boolean;
    /** The session ended without the user asking (revoked or expired refresh token). */
    sessionExpired?: boolean;
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
  signOutPending: false,
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
  // Lists hold private notes and collaborators: never show them to the next account.
  const { useChecklistStore } =
    require("./useChecklistStore") as typeof import("./useChecklistStore");
  const { usePortfolioStore } =
    require("./usePortfolioStore") as typeof import("./usePortfolioStore");
  useChecklistStore.getState()._reset();
  usePortfolioStore.getState()._reset();
  // A half-written review (and its clientReviewId) belongs to the account that wrote it.
  const { useReviewDraftStore } =
    require("./useReviewDraftStore") as typeof import("./useReviewDraftStore");
  useReviewDraftStore.getState().resetDraft();
  // Gamification and submissions skip reloading once isLoaded is set: reset them per account.
  const { useFoodCredStore } = require("./useFoodCredStore") as typeof import("./useFoodCredStore");
  const { useMissionStore } = require("./useMissionStore") as typeof import("./useMissionStore");
  const { usePassportStore } = require("./usePassportStore") as typeof import("./usePassportStore");
  const { useStallSubmissionStore } =
    require("./useStallSubmissionStore") as typeof import("./useStallSubmissionStore");
  useFoodCredStore.getState()._reset();
  useMissionStore.getState()._reset();
  usePassportStore.getState()._reset();
  useStallSubmissionStore.getState()._reset();
  const { clearCommunitySafetySessionState } =
    require("@/lib/security/communitySafety") as typeof import("@/lib/security/communitySafety");
  clearCommunitySafetySessionState();
}

/**
 * Recent searches and unsent review drafts belong to the account that wrote them. Cleared on a
 * deliberate sign-out or an account switch, not on session expiry (the same user signs back in).
 */
function clearAccountLocalHistory(): void {
  const { useSearchStore } = require("./useSearchStore") as typeof import("./useSearchStore");
  const { useReviewDraftStore } =
    require("./useReviewDraftStore") as typeof import("./useReviewDraftStore");
  useSearchStore.getState().clearSearchState();
  useReviewDraftStore.getState().resetDraft();
  // The data export is a full copy of the account's personal data; it must not outlive sign-out.
  deleteExportFile();
}

/** Account whose follow state was already loaded during this app launch. */
let followStateSyncedUserId: string | null = null;

/**
 * Follow state lives on the server; load it on sign-in so a new device shows it, and once
 * per launch for a restored session so follows changed on another device are picked up.
 */
function syncFollowStateFromServer(
  userId: string | null | undefined,
  options?: { oncePerLaunch?: boolean },
): void {
  if (!userId) return;
  // Following list is authenticated-only; skip placeholder ids such as the local "guest-user".
  if (getConfiguredDataSource() === "supabase" && !isUuidLike(userId)) return;
  if (options?.oncePerLaunch && followStateSyncedUserId === userId) return;
  followStateSyncedUserId = userId;
  const { useSocialStore } = require("./useSocialStore") as typeof import("./useSocialStore");
  void useSocialStore
    .getState()
    .syncFollowedUserIds(userId)
    .catch((error) => {
      console.error("Failed to load follow state", error);
    });
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

// The single place sign_up_completed is logged: from the first SIGNED_IN of a new
// account (Supabase) or from completeAuth({ isNewUser }) (mock / auto-confirm).
// It also claims the sign-in slot so the same login is not counted twice.
function trackSignUpCompletedOnce(profileId: string, method: string): void {
  if (signInTrackedForUserId === profileId) {
    return;
  }
  signInTrackedForUserId = profileId;
  const shareAttribution = getShareAttribution();
  trackAnalyticsEvent(
    "sign_up_completed",
    {
      method,
      ...(shareAttribution
        ? { share_source: shareAttribution.source, share_route: shareAttribution.route }
        : {}),
    },
    { userId: profileId },
  );
  if (shareAttribution) clearShareAttribution();
}

// A server sign-out the app asked for itself (account deletion signs out inside the service,
// before the screen clears the session) must not be reported as an expired session.
const EXPECTED_SIGN_OUT_WINDOW_MS = 15_000;
let expectedSignOutUntil = 0;

export function expectSignOut(): void {
  expectedSignOutUntil = Date.now() + EXPECTED_SIGN_OUT_WINDOW_MS;
}

// Stamps the account as onboarded (service.auth.markOnboarded) once the user is signed in
// and has finished first-run onboarding, so the next sign-in knows it is an existing account.
let onboardedStampedForUserId: string | null = null;

function markAccountOnboarded(): void {
  const state = useSessionStore.getState();
  const userId = state.authenticatedUserId;
  if (
    getConfiguredDataSource() !== "supabase" ||
    !state.isAuthenticated ||
    !state.hasCompletedOnboarding ||
    !userId ||
    onboardedStampedForUserId === userId
  ) {
    return;
  }
  onboardedStampedForUserId = userId;
  void getHungryService()
    .auth.markOnboarded()
    .catch(() => {
      // Try again on the next auth event.
      onboardedStampedForUserId = null;
    });
}

const PUSH_TOKEN_UNBIND_TIMEOUT_MS = 3000;

// Unbind this device's push token while the session can still authorize it,
// then end the Supabase session. A slow or failed unbind never blocks sign-out.
// signOutPending stays set until the stored session is gone, so a sign-out the
// app is closed during is finished on the next launch instead of restored.
function signOutOfSupabase(): Promise<void> {
  const service = getHungryService();
  const unbind = service.push.unregisterPushToken().catch(() => undefined);
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, PUSH_TOKEN_UNBIND_TIMEOUT_MS));
  return Promise.race([unbind, timeout])
    .then(() => service.auth.signOut())
    .then(() => {
      useSessionStore.setState({ signOutPending: false });
    })
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
          clearAccountLocalHistory();
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
        if (!shouldAuthenticate) {
          return;
        }
        markAccountOnboarded();
        const syncedProfile = getProfileStoreState().profile;
        const profileId = syncedProfile?.id ?? "guest-user";
        scheduleIdleWork(
          () => {
            identifyPostHogUser(profileId, buildPostHogIdentityProperties());
            syncFollowStateFromServer(nextUserId);
            if (options?.isNewUser) {
              trackSignUpCompletedOnce(profileId, options.authProvider ?? "email");
            } else if (options?.trackSignInEvent ?? true) {
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
        // onboarding_completed fires once; a returning user's saved state is kept.
        if (useSessionStore.getState().hasCompletedOnboarding) {
          return;
        }
        set({
          hasCompletedOnboarding: true,
          hasSkippedTasteQuiz: skippedQuiz,
        });
        trackAnalyticsEvent("onboarding_completed", {
          skipped_quiz: skippedQuiz,
        });
        markAccountOnboarded();
      },
      expireSession: () => {
        const profileId = getSafeProfileId();
        set({ sessionExpired: true, isAuthenticated: false });
        clearAccountScopedStores();
        resetPostHogUser();
        resetSignInTracking();
        trackAnalyticsEvent("sign_out", { reason: "session_expired" }, { userId: profileId });
      },
      dismissSessionExpiry: () => set({ sessionExpired: false }),
      setReturnRoute: (returnRoute) => set({ returnRoute }),
      setSkippedTasteQuiz: (hasSkippedTasteQuiz) => set({ hasSkippedTasteQuiz }),
      setPasswordRecoveryInProgress: (passwordRecoveryInProgress) =>
        set({ passwordRecoveryInProgress }),
      signOut: () => {
        const profileId = getSafeProfileId();
        const hasSkippedTasteQuiz = useSessionStore.getState().hasSkippedTasteQuiz;
        const isSupabase = getConfiguredDataSource() === "supabase";
        set({
          ...initialState,
          isAuthReady: true,
          hasCompletedOnboarding: true,
          hasSkippedTasteQuiz,
          signOutPending: isSupabase,
        });
        if (isSupabase) {
          void signOutOfSupabase();
        }
        clearAccountScopedStores();
        clearAccountLocalHistory();
        getProfileStoreState().clearProfile();
        getProfileStoreState().syncProfile(false);
        resetPostHogUser();
        resetSignInTracking();
        trackAnalyticsEvent("sign_out", { reason: "manual" }, { userId: profileId });
      },
      finishPendingSignOut: (): Promise<void> =>
        useSessionStore.getState().signOutPending && getConfiguredDataSource() === "supabase"
          ? signOutOfSupabase()
          : Promise.resolve(),
      clearSession: () => {
        const profileId = getSafeProfileId();
        set({ ...initialState, isAuthReady: true });
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
            clearAccountLocalHistory();
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
            signOutPending: false,
          }));
          syncProfileForAuthState(true, session.userId);
          markAccountOnboarded();

          const profile = getProfileStoreState().profile;
          const profileId = session.userId ?? profile?.id ?? "guest-user";
          scheduleIdleWork(
            () => {
              identifyPostHogUser(profileId, buildPostHogIdentityProperties());
              syncFollowStateFromServer(nextUserId, { oncePerLaunch: true });
              // Only a sign-in that starts a session counts: a SIGNED_IN replayed
              // for a session restored from storage is never a new sign-up.
              if (session.isNewUser && !currentlyAuthenticated) {
                trackSignUpCompletedOnce(profileId, session.authProvider ?? "email");
              } else if (!currentlyAuthenticated) {
                trackSignInCompletedOnce(profileId, {
                  method: session.authProvider ?? "email",
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
        const expired =
          (session.sessionExpired ?? false) &&
          !useSessionStore.getState().signOutPending &&
          Date.now() >= expectedSignOutUntil;
        set({
          isAuthenticated: false,
          isAuthReady: true,
          authenticatedUserId: null,
          authDataSource: null,
          sessionExpired: expired,
        });
        clearAccountScopedStores();
        getProfileStoreState().syncProfile(false);
        resetPostHogUser();
        resetSignInTracking();
        trackAnalyticsEvent(
          "sign_out",
          { reason: expired ? "session_expired" : "supabase_auth_state_change" },
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
        signOutPending: state.signOutPending,
        // Where a guest was headed when sign-up sent them to the email app: a cold-start
        // confirmation link still returns them there.
        returnRoute: state.returnRoute,
      }),
      // A corrupt persisted value rehydrates with no state; mark hydrated anyway
      // so bootstrap still runs and Splash cannot hang on isAuthReady.
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.markHydrated();
          return;
        }
        setTimeout(() => useSessionStore.getState().markHydrated(), 0);
      },
    },
  ),
);
