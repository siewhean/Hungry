import { create } from "zustand";

import { useProfileStore } from "./useProfileStore";

interface SessionState {
  isAuthenticated: boolean;
  isGuest: boolean;
  hasCompletedOnboarding: boolean;
  hasSkippedTasteQuiz: boolean;
  returnRoute?: string;
  sessionExpired: boolean;
  completeAuth: () => void;
  completeOnboarding: (skippedQuiz?: boolean) => void;
  continueAsGuest: () => void;
  expireSession: () => void;
  dismissSessionExpiry: () => void;
  setReturnRoute: (route?: string) => void;
  signOut: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  isAuthenticated: false,
  isGuest: true,
  hasCompletedOnboarding: false,
  hasSkippedTasteQuiz: true,
  returnRoute: undefined,
  sessionExpired: false,
  completeAuth: () => {
    set({
      isAuthenticated: true,
      isGuest: false,
      sessionExpired: false,
    });
    useProfileStore.getState().syncProfile(true);
  },
  completeOnboarding: (skippedQuiz = false) =>
    set({
      hasCompletedOnboarding: true,
      hasSkippedTasteQuiz: skippedQuiz,
    }),
  continueAsGuest: () =>
    set({
      isAuthenticated: false,
      isGuest: true,
    }),
  expireSession: () => set({ sessionExpired: true, isAuthenticated: false, isGuest: true }),
  dismissSessionExpiry: () => set({ sessionExpired: false }),
  setReturnRoute: (returnRoute) => set({ returnRoute }),
  signOut: () => {
    set({
      isAuthenticated: false,
      isGuest: true,
      returnRoute: undefined,
      hasCompletedOnboarding: false,
      hasSkippedTasteQuiz: true,
    });
    useProfileStore.getState().syncProfile(false);
  },
}));
