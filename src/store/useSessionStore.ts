import { create } from "zustand";

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
  setSkippedTasteQuiz: (skipped: boolean) => void;
  signOut: () => void;
  clearSession: () => void;
}

const initialState = {
  isAuthenticated: false,
  isGuest: true,
  hasCompletedOnboarding: false,
  hasSkippedTasteQuiz: true,
  returnRoute: undefined,
  sessionExpired: false,
} as const;

export const useSessionStore = create<SessionState>((set) => ({
  ...initialState,
  completeAuth: () =>
    set({
      isAuthenticated: true,
      isGuest: false,
      sessionExpired: false,
    }),
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
  setSkippedTasteQuiz: (hasSkippedTasteQuiz) => set({ hasSkippedTasteQuiz }),
  signOut: () => set({ ...initialState }),
  clearSession: () => set({ ...initialState }),
}));
