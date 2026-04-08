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

interface UIState {
  offline: boolean;
  toast?: ToastPayload;
  reviewSuccess?: ReviewSuccessPayload;
  setOffline: (offline: boolean) => void;
  showToast: (toast: ToastPayload) => void;
  clearToast: () => void;
  showReviewSuccess: (payload: ReviewSuccessPayload) => void;
  hideReviewSuccess: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  offline: false,
  toast: undefined,
  reviewSuccess: undefined,
  setOffline: (offline) => set({ offline }),
  showToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: undefined }),
  showReviewSuccess: (reviewSuccess) => set({ reviewSuccess }),
  hideReviewSuccess: () => set({ reviewSuccess: undefined }),
}));
