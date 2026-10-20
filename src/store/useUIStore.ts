import { create } from "zustand";
import { persist } from "zustand/middleware";

import { hungryPersistStorage } from "./persistStorage";

export type ToastTone = "success" | "error" | "info" | "warning";

export interface ToastPayload {
  message: string;
  tone?: ToastTone;
  duration?: number;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  iconColor?: string;
  borderWidth?: number;
}

export interface ReviewSuccessPayload {
  dishName: string;
  venueName: string;
  xpEarned: number;
  pointsEarned?: number;
  tagCount?: number;
  rating?: number;
}

export type ThemePreference = "system" | "light" | "dark";

interface UIState {
  toast: ToastPayload | null;
  showToast: (payload: ToastPayload) => void;
  hideToast: () => void;
  clearToast: () => void;
  lastScrollY: number;
  isHeaderCollapsed: boolean;
  scrollBackVisible: boolean;
  registerScrollForBack: (y: number) => void;
  resetScrollBack: () => void;
  reviewSuccess: ReviewSuccessPayload | null;
  showReviewSuccess: (payload: ReviewSuccessPayload) => void;
  hideReviewSuccess: () => void;
  isOffline: boolean;
  setOffline: (offline: boolean) => void;
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
  hapticFeedbackEnabled: boolean;
  setHapticFeedbackEnabled: (enabled: boolean) => void;
  reducedMotionEnabled: boolean;
  setReducedMotionEnabled: (enabled: boolean) => void;
  allowSearchHistory: boolean;
  setAllowSearchHistory: (enabled: boolean) => void;
  /** Device setting: kept across sign-outs and never overwritten by a server profile. */
  leftHandedMode: boolean;
  setLeftHandedMode: (enabled: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      toast: null,
      showToast: (payload) => set({ toast: payload }),
      hideToast: () => set({ toast: null }),
      clearToast: () => set({ toast: null }),
      lastScrollY: 0,
      isHeaderCollapsed: false,
      scrollBackVisible: false,
      registerScrollForBack: (y) => {
        set((state) => {
          const diff = y - state.lastScrollY;
          const isHeaderCollapsed = y > 60 && diff > 0;
          const scrollBackVisible = y > 300 && diff < -20;
          return { lastScrollY: y, isHeaderCollapsed, scrollBackVisible };
        });
      },
      resetScrollBack: () => set({ scrollBackVisible: false }),
      reviewSuccess: null,
      showReviewSuccess: (payload) => set({ reviewSuccess: payload }),
      hideReviewSuccess: () => set({ reviewSuccess: null }),
      isOffline: false,
      setOffline: (offline) => set({ isOffline: offline }),
      themePreference: "system",
      setThemePreference: (themePreference) => set({ themePreference }),
      hapticFeedbackEnabled: true,
      setHapticFeedbackEnabled: (hapticFeedbackEnabled) => set({ hapticFeedbackEnabled }),
      reducedMotionEnabled: false,
      setReducedMotionEnabled: (reducedMotionEnabled) => set({ reducedMotionEnabled }),
      allowSearchHistory: true,
      setAllowSearchHistory: (allowSearchHistory) => set({ allowSearchHistory }),
      leftHandedMode: false,
      setLeftHandedMode: (leftHandedMode) => set({ leftHandedMode }),
    }),
    {
      name: "hungry-ui-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({
        themePreference: state.themePreference,
        hapticFeedbackEnabled: state.hapticFeedbackEnabled,
        reducedMotionEnabled: state.reducedMotionEnabled,
        allowSearchHistory: state.allowSearchHistory,
        leftHandedMode: state.leftHandedMode,
      }),
    },
  ),
);
