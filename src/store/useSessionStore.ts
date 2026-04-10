import { create } from "zustand";
import { persist } from "zustand/middleware";

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
      },
      completeOnboarding: (skippedQuiz = false) =>
        set({
          hasCompletedOnboarding: true,
          hasSkippedTasteQuiz: skippedQuiz,
        }),
      expireSession: () => set({ sessionExpired: true, isAuthenticated: false }),
      dismissSessionExpiry: () => set({ sessionExpired: false }),
      setReturnRoute: (returnRoute) => set({ returnRoute }),
      setSkippedTasteQuiz: (hasSkippedTasteQuiz) => set({ hasSkippedTasteQuiz }),
      signOut: () => {
        set({ ...initialState });
        useProfileStore.getState().syncProfile(false);
      },
      clearSession: () => {
        set({ ...initialState });
        useProfileStore.getState().syncProfile(false);
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
