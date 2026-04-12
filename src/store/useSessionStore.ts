import { create } from "zustand";
import { persist } from "zustand/middleware";

import { trackAnalyticsEvent } from "@/lib/analytics";
import type { AuthProvider } from "@/lib/services/types";
import { useProfileStore } from "./useProfileStore";
import { hungryPersistStorage } from "./persistStorage";

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
          hasCompletedOnboarding: options?.completedOnboarding ?? state.hasCompletedOnboarding,
          hasSkippedTasteQuiz: options?.skippedTasteQuiz ?? state.hasSkippedTasteQuiz,
          sessionExpired: false,
        }));
        useProfileStore.getState().syncProfile(true);
        trackAnalyticsEvent("sign_in_completed", {
          method: options?.authProvider ?? "email",
          has_completed_onboarding: options?.completedOnboarding ?? false,
          skipped_taste_quiz: options?.skippedTasteQuiz ?? false,
        });
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
        set({ sessionExpired: true, isAuthenticated: false });
        trackAnalyticsEvent("sign_out", { reason: "session_expired" });
      },
      dismissSessionExpiry: () => set({ sessionExpired: false }),
      setReturnRoute: (returnRoute) => set({ returnRoute }),
      setSkippedTasteQuiz: (hasSkippedTasteQuiz) => set({ hasSkippedTasteQuiz }),
      signOut: () => {
        set({ ...initialState });
        useProfileStore.getState().syncProfile(false);
        trackAnalyticsEvent("sign_out", { reason: "manual" });
      },
      clearSession: () => {
        set({ ...initialState });
        useProfileStore.getState().syncProfile(false);
        trackAnalyticsEvent("sign_out", { reason: "clear_session" });
      },
      markHydrated: () => set({ hasHydrated: true }),
    }),
    {
      name: "hungry-session-v1",
      storage: hungryPersistStorage,
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
