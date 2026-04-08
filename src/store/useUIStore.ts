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
  softGateVisible: boolean;
  toast?: ToastPayload;
  reviewSuccess?: ReviewSuccessPayload;
  setOffline: (offline: boolean) => void;
  showSoftGate: () => void;
  hideSoftGate: () => void;
  showToast: (toast: ToastPayload) => void;
  clearToast: () => void;
  showReviewSuccess: (payload: ReviewSuccessPayload) => void;
  hideReviewSuccess: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  offline: false,
  softGateVisible: false,
  toast: undefined,
  reviewSuccess: undefined,
  setOffline: (offline) => set({ offline }),
  showSoftGate: () => set({ softGateVisible: true }),
  hideSoftGate: () => set({ softGateVisible: false }),
  showToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: undefined }),
  showReviewSuccess: (reviewSuccess) => set({ reviewSuccess }),
  hideReviewSuccess: () => set({ reviewSuccess: undefined }),
}));
