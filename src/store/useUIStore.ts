import { create } from "zustand";

interface ToastPayload {
  message: string;
  tone?: "info" | "success" | "warning" | "error";
}

interface ReviewSuccessPayload {
  dishName: string;
  venueName: string;
  pointsEarned: number;
  tagCount: number;
  rating: number;
}

interface QuickReviewPayload {
  venueId: string;
  venueName: string;
  dishId?: string;
  dishName?: string;
}

interface UIState {
  offline: boolean;
  toast?: ToastPayload;
  reviewSuccess?: ReviewSuccessPayload;
  quickReview?: QuickReviewPayload;
  scrollBackVisible: boolean;
  lastScrollY: number;
  setOffline: (offline: boolean) => void;
  showToast: (toast: ToastPayload) => void;
  clearToast: () => void;
  showReviewSuccess: (payload: ReviewSuccessPayload) => void;
  hideReviewSuccess: () => void;
  showQuickReview: (payload: QuickReviewPayload) => void;
  hideQuickReview: () => void;
  setScrollBackVisible: (visible: boolean) => void;
  registerScrollForBack: (offsetY: number) => void;
  resetScrollBack: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  offline: false,
  toast: undefined,
  reviewSuccess: undefined,
  quickReview: undefined,
  scrollBackVisible: false,
  lastScrollY: 0,
  setOffline: (offline) => set({ offline }),
  showToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: undefined }),
  showReviewSuccess: (reviewSuccess) => set({ reviewSuccess }),
  hideReviewSuccess: () => set({ reviewSuccess: undefined }),
  showQuickReview: (quickReview) => set({ quickReview }),
  hideQuickReview: () => set({ quickReview: undefined }),
  setScrollBackVisible: (visible) => set({ scrollBackVisible: visible }),
  registerScrollForBack: (offsetY) =>
    set((state) => {
      const y = Math.max(0, offsetY);
      const delta = y - state.lastScrollY;

      if (delta < 0) {
        return { scrollBackVisible: true, lastScrollY: y };
      }

      if (delta > 0) {
        return { scrollBackVisible: false, lastScrollY: y };
      }

      return { lastScrollY: y };
    }),
  resetScrollBack: () => set({ scrollBackVisible: false, lastScrollY: 0 }),
}));
