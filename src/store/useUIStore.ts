import { create } from "zustand";

interface ToastPayload {
  message: string;
  tone?: "info" | "success" | "warning" | "error";
}

interface UIState {
  offline: boolean;
  softGateVisible: boolean;
  toast?: ToastPayload;
  setOffline: (offline: boolean) => void;
  showSoftGate: () => void;
  hideSoftGate: () => void;
  showToast: (toast: ToastPayload) => void;
  clearToast: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  offline: false,
  softGateVisible: false,
  toast: undefined,
  setOffline: (offline) => set({ offline }),
  showSoftGate: () => set({ softGateVisible: true }),
  hideSoftGate: () => set({ softGateVisible: false }),
  showToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: undefined }),
}));

