import { create } from "zustand";
import { persist } from "zustand/middleware";

import { trackAnalyticsEvent } from "@/lib/analytics";
import {
  identifyPostHogUser,
  resetPostHogUser,
} from "@/lib/analytics/posthogSink";
import type { AuthProvider } from "@/lib/services/types";
import { useProfileStore } from "./useProfileStore";
import { useLocationStore } from "./useLocationStore";
import { hungrySecurePersistStorage } from "./secureStorage";

export interface PendingRoute {
  name: string;
  params?: Record<string, unknown>;
}

interface SessionState {
  hasHydrated: boolean;
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
}

const initialState = {
  hasHydrated: false,
  isAuthenticated: false,
  hasCompletedOnboarding: false,
  hasSkippedTasteQuiz: false,
  returnRoute: undefined,
  sessionExpired: false,
} as const;

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      ...initialState,
      completeAuth: (options) => {
        set((state) => ({
          isAuthenticated: true,
          hasCompletedOnboarding:
            options?.completedOnboarding ?? state.hasCompletedOnboarding,
          hasSkippedTasteQuiz:
            options?.skippedTasteQuiz ?? state.hasSkippedTasteQuiz,
          sessionExpired: false,
        }));
        useProfileStore.getState().syncProfile(true);
        const profile = useProfileStore.getState().profile;
        const location = useLocationStore.getState();
        const area =
          location.manualLocation ??
          `${location.currentLocation.latitude.toFixed(4)},${location.currentLocation.longitude.toFixed(4)}`;
        identifyPostHogUser(profile.id, {
          tasteVector: profile.tasteVector,
          dietaryPreferences: profile.dietaryPreferences,
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
            { userId: profile.id },
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
        const profileId = useProfileStore.getState().profile.id;
        set({ sessionExpired: true, isAuthenticated: false });
        resetPostHogUser();
        trackAnalyticsEvent(
          "sign_out",
          { reason: "session_expired" },
          { userId: profileId },
        );
      },
      dismissSessionExpiry: () => set({ sessionExpired: false }),
      setReturnRoute: (returnRoute) => set({ returnRoute }),
      setSkippedTasteQuiz: (hasSkippedTasteQuiz) =>
        set({ hasSkippedTasteQuiz }),
      signOut: () => {
        const profileId = useProfileStore.getState().profile.id;
        set({ ...initialState });
        useProfileStore.getState().clearProfile();
        useProfileStore.getState().syncProfile(false);
        resetPostHogUser();
        trackAnalyticsEvent(
          "sign_out",
          { reason: "manual" },
          { userId: profileId },
        );
      },
      clearSession: () => {
        const profileId = useProfileStore.getState().profile.id;
        set({ ...initialState });
        useProfileStore.getState().clearProfile();
        useProfileStore.getState().syncProfile(false);
        resetPostHogUser();
        trackAnalyticsEvent(
          "sign_out",
          { reason: "clear_session" },
          { userId: profileId },
        );
      },
      markHydrated: () => set({ hasHydrated: true }),
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
