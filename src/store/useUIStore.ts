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

export interface QuickReviewPayload {
  venueId: string;
  venueName: string;
  dishId?: string;
  dishName?: string;
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
  quickReview: QuickReviewPayload | null;
  showQuickReview: (payload: QuickReviewPayload) => void;
  hideQuickReview: () => void;
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
  showLocationBadge: boolean;
  setShowLocationBadge: (enabled: boolean) => void;
  allowSearchHistory: boolean;
  setAllowSearchHistory: (enabled: boolean) => void;
  openToExternalApps: boolean;
  setOpenToExternalApps: (enabled: boolean) => void;
  dietaryFiltersEnabled: boolean;
  setDietaryFiltersEnabled: (enabled: boolean) => void;
  activityFeedEnabled: boolean;
  setActivityFeedEnabled: (enabled: boolean) => void;
  hideReviewedDishesFromFeed: boolean;
  setHideReviewedDishesFromFeed: (enabled: boolean) => void;
  showOnlyFavoriteDishes: boolean;
  setShowOnlyFavoriteDishes: (enabled: boolean) => void;
  pushNotificationsEnabled: boolean;
  setPushNotificationsEnabled: (enabled: boolean) => void;
  missionNotificationsEnabled: boolean;
  setMissionNotificationsEnabled: (enabled: boolean) => void;
  showCredTier: boolean;
  setShowCredTier: (enabled: boolean) => void;
  showPassportProgress: boolean;
  setShowPassportProgress: (enabled: boolean) => void;
  showProfileBadges: boolean;
  setShowProfileBadges: (enabled: boolean) => void;
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
      quickReview: null,
      showQuickReview: (payload) => set({ quickReview: payload }),
      hideQuickReview: () => set({ quickReview: null }),
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
      showLocationBadge: true,
      setShowLocationBadge: (showLocationBadge) => set({ showLocationBadge }),
      allowSearchHistory: true,
      setAllowSearchHistory: (allowSearchHistory) => set({ allowSearchHistory }),
      openToExternalApps: true,
      setOpenToExternalApps: (openToExternalApps) => set({ openToExternalApps }),
      dietaryFiltersEnabled: true,
      setDietaryFiltersEnabled: (dietaryFiltersEnabled) => set({ dietaryFiltersEnabled }),
      activityFeedEnabled: true,
      setActivityFeedEnabled: (activityFeedEnabled) => set({ activityFeedEnabled }),
      hideReviewedDishesFromFeed: false,
      setHideReviewedDishesFromFeed: (hideReviewedDishesFromFeed) =>
        set({ hideReviewedDishesFromFeed }),
      showOnlyFavoriteDishes: false,
      setShowOnlyFavoriteDishes: (showOnlyFavoriteDishes) => set({ showOnlyFavoriteDishes }),
      pushNotificationsEnabled: true,
      setPushNotificationsEnabled: (pushNotificationsEnabled) => set({ pushNotificationsEnabled }),
      missionNotificationsEnabled: true,
      setMissionNotificationsEnabled: (missionNotificationsEnabled) =>
        set({ missionNotificationsEnabled }),
      showCredTier: true,
      setShowCredTier: (showCredTier) => set({ showCredTier }),
      showPassportProgress: true,
      setShowPassportProgress: (showPassportProgress) => set({ showPassportProgress }),
      showProfileBadges: true,
      setShowProfileBadges: (showProfileBadges) => set({ showProfileBadges }),
    }),
    {
      name: "hungry-ui-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({
        themePreference: state.themePreference,
        hapticFeedbackEnabled: state.hapticFeedbackEnabled,
        reducedMotionEnabled: state.reducedMotionEnabled,
        showLocationBadge: state.showLocationBadge,
        allowSearchHistory: state.allowSearchHistory,
        openToExternalApps: state.openToExternalApps,
        dietaryFiltersEnabled: state.dietaryFiltersEnabled,
        activityFeedEnabled: state.activityFeedEnabled,
        hideReviewedDishesFromFeed: state.hideReviewedDishesFromFeed,
        showOnlyFavoriteDishes: state.showOnlyFavoriteDishes,
        pushNotificationsEnabled: state.pushNotificationsEnabled,
        missionNotificationsEnabled: state.missionNotificationsEnabled,
        showCredTier: state.showCredTier,
        showPassportProgress: state.showPassportProgress,
        showProfileBadges: state.showProfileBadges,
      }),
    },
  ),
);
