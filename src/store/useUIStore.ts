import { create } from "zustand";

export type ToastTone = "success" | "error" | "info" | "warning";

export interface ToastPayload {
  message: string;
  tone?: ToastTone;
  duration?: number;
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
}

export const useUIStore = create<UIState>((set) => ({
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
}));
