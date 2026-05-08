import { create } from "zustand";
import { persist } from "zustand/middleware";

import { trackAnalyticsEvent } from "@/lib/analytics";
import { identifyPostHogUser, resetPostHogUser } from "@/lib/analytics/posthogSink";
import type { AuthProvider } from "@/lib/services/types";
import { getConfiguredDataSource } from "@/lib/services/supabase/client";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "./useProfileStore";
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
  returnRoute: undefined,
  sessionExpired: false,
} as const;

function getSafeProfileId(): string {
  return useProfileStore.getState().profile?.id ?? "guest-user";
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      ...initialState,
      completeAuth: (options) => {
        set((state) => ({
          isAuthReady: true,
          isAuthenticated: true,
          hasCompletedOnboarding: options?.completedOnboarding ?? state.hasCompletedOnboarding,
          hasSkippedTasteQuiz: options?.skippedTasteQuiz ?? state.hasSkippedTasteQuiz,
          sessionExpired: false,
        }));
        useProfileStore.getState().syncProfile(true);
        const profile = useProfileStore.getState().profile;
        const profileId = profile?.id ?? "guest-user";
        const location = useLocationStore.getState();
        const area =
          location.manualLocation ??
          `${location.currentLocation.latitude.toFixed(3)},${location.currentLocation.longitude.toFixed(3)}`;
        identifyPostHogUser(profileId, {
          tasteVector: profile?.tasteVector,
          dietaryPreferences: profile?.dietaryPreferences,
          area,
        });
        if (options?.trackSignInEvent ?? true) {
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
        useProfileStore.getState().clearProfile();
        useProfileStore.getState().syncProfile(false);
        resetPostHogUser();
        trackAnalyticsEvent("sign_out", { reason: "manual" }, { userId: profileId });
      },
      clearSession: () => {
        const profileId = getSafeProfileId();
        set({ ...initialState, isAuthReady: true });
        useProfileStore.getState().clearProfile();
        useProfileStore.getState().syncProfile(false);
        resetPostHogUser();
        trackAnalyticsEvent("sign_out", { reason: "clear_session" }, { userId: profileId });
      },
      markHydrated: () => set({ hasHydrated: true }),
      markAuthReady: () => set({ isAuthReady: true }),
      applyAuthStateFromSession: (session) => {
        const currentlyAuthenticated = useSessionStore.getState().isAuthenticated;

        if (session.isAuthenticated) {
          set((state) => ({
            isAuthenticated: true,
            isAuthReady: true,
            hasCompletedOnboarding: session.completedOnboarding ?? state.hasCompletedOnboarding,
            hasSkippedTasteQuiz: session.skippedTasteQuiz ?? state.hasSkippedTasteQuiz,
            sessionExpired: false,
          }));
          useProfileStore.getState().syncProfile(true);

          const profile = useProfileStore.getState().profile;
          const profileId = session.userId ?? profile?.id ?? "guest-user";
          const location = useLocationStore.getState();
          const area =
            location.manualLocation ??
            `${location.currentLocation.latitude.toFixed(3)},${location.currentLocation.longitude.toFixed(3)}`;
          identifyPostHogUser(profileId, {
            tasteVector: profile?.tasteVector,
            dietaryPreferences: profile?.dietaryPreferences,
            area,
          });

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
          sessionExpired: false,
        });
        useProfileStore.getState().syncProfile(false);
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
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        hasSkippedTasteQuiz: state.hasSkippedTasteQuiz,
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);
