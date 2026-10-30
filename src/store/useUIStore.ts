import { create } from "zustand";
import { persist } from "zustand/middleware";

import { applyAnalyticsPreference } from "@/lib/analytics/preference";

import { hungryPersistStorage } from "./persistStorage";

export type ToastTone = "success" | "error" | "info" | "warning";

export interface ToastPayload {
  message: string;
  tone?: ToastTone;
  duration?: number;
  /** A button on the toast, e.g. Undo. The toast stays up for `duration` so there is time to tap. */
  action?: { label: string; onPress: () => void };
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  iconColor?: string;
  borderWidth?: number;
}

export interface ReviewSuccessPayload {
  /** The new review, so the confirmation can offer to share it. */
  reviewId?: string;
  dishId?: string;
  dishName: string;
  venueName: string;
  xpEarned: number;
  pointsEarned?: number;
  tagCount?: number;
  rating?: number;
}

export type ThemePreference = "system" | "light" | "dark";

/** Guest sign-in sheet, e.g. "Sign in to save Chicken Rice". */
export interface SignInPrompt {
  title: string;
}

export type SafetyReportReason = "spam" | "offensive" | "wrong_place" | "other";

/**
 * The report / hide / block sheet for one post or comment. The sheet is app-wide (see
 * SafetyActionsSheet); the callbacks do the work so the sheet holds no service logic.
 */
export interface SafetyMenu {
  /** "post" or "comment": the word used in the sheet copy. */
  label: string;
  authorName: string;
  canHide: boolean;
  /** False for seeded content with no account behind it. */
  canBlock: boolean;
  onReport: (reason: SafetyReportReason) => void;
  onHide: () => void;
  onBlock: () => void;
}

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
  /** "Share usage analytics": on by default, a device setting that survives sign-out. */
  analyticsEnabled: boolean;
  setAnalyticsEnabled: (enabled: boolean) => void;
  /** Device setting: kept across sign-outs and never overwritten by a server profile. */
  leftHandedMode: boolean;
  setLeftHandedMode: (enabled: boolean) => void;
  signInPrompt: SignInPrompt | null;
  /** The one guest action (save, like, follow) to finish after sign-in. Never persisted. */
  pendingAuthAction: (() => void) | null;
  openSignInPrompt: (prompt: SignInPrompt, action?: () => void) => void;
  closeSignInPrompt: () => void;
  /** Returns the pending action and clears the slot, so it runs at most once. */
  takePendingAuthAction: () => (() => void) | null;
  safetyMenu: SafetyMenu | null;
  openSafetyMenu: (menu: SafetyMenu) => void;
  closeSafetyMenu: () => void;
  /**
   * While set, the app-wide "+N Food Cred" pill waits and counts the points it was handed,
   * so a popup that follows the award (the "you tried it" popup) can show them itself.
   */
  credHold: { points: number } | null;
  holdCredToast: () => void;
  addHeldCredPoints: (points: number) => void;
  /** Ends the hold; `show` replays the held points as the pill (nothing used them). */
  releaseCredToast: (show: boolean) => void;
  /** A replay of held points for the pill to show; set by `releaseCredToast(true)`. */
  credReplay: { id: number; points: number } | null;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
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
      analyticsEnabled: true,
      setAnalyticsEnabled: (analyticsEnabled) => {
        applyAnalyticsPreference(analyticsEnabled);
        set({ analyticsEnabled });
      },
      leftHandedMode: false,
      setLeftHandedMode: (leftHandedMode) => set({ leftHandedMode }),
      signInPrompt: null,
      pendingAuthAction: null,
      openSignInPrompt: (signInPrompt, action) =>
        set({ signInPrompt, pendingAuthAction: action ?? null }),
      closeSignInPrompt: () => set({ signInPrompt: null }),
      takePendingAuthAction: () => {
        const action = get().pendingAuthAction;
        set({ pendingAuthAction: null });
        return action;
      },
      safetyMenu: null,
      openSafetyMenu: (safetyMenu) => set({ safetyMenu }),
      closeSafetyMenu: () => set({ safetyMenu: null }),
      credHold: null,
      credReplay: null,
      holdCredToast: () => set({ credHold: { points: 0 } }),
      addHeldCredPoints: (points) =>
        set((state) =>
          state.credHold ? { credHold: { points: state.credHold.points + points } } : state,
        ),
      releaseCredToast: (show) =>
        set((state) => {
          const held = state.credHold;
          if (!held) return state;
          if (show && held.points > 0) {
            return {
              credHold: null,
              credReplay: { id: (state.credReplay?.id ?? 0) + 1, points: held.points },
            };
          }
          return { credHold: null };
        }),
    }),
    {
      name: "hungry-ui-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({
        themePreference: state.themePreference,
        hapticFeedbackEnabled: state.hapticFeedbackEnabled,
        reducedMotionEnabled: state.reducedMotionEnabled,
        allowSearchHistory: state.allowSearchHistory,
        analyticsEnabled: state.analyticsEnabled,
        leftHandedMode: state.leftHandedMode,
      }),
      // A saved opt-out applies before the first event of the next launch is sent.
      onRehydrateStorage: () => (state) => {
        if (state && state.analyticsEnabled === false) applyAnalyticsPreference(false);
      },
    },
  ),
);
