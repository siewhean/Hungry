import { create } from "zustand";

import { useProfileStore } from "./useProfileStore";

export interface PendingRoute {
  name: string;
  params?: Record<string, unknown>;
}

interface SessionState {
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
}

const initialState = {
  isAuthenticated: false,
  hasCompletedOnboarding: false,
  hasSkippedTasteQuiz: false,
  returnRoute: undefined,
  sessionExpired: false,
} as const;

export const useSessionStore = create<SessionState>((set) => ({
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
}));
