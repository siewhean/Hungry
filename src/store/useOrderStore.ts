import { create } from "zustand";

export type OrderStatus = "draft" | "placed" | "accepted" | "preparing" | "ready" | "collected";

export interface OrderRecord {
  id: string;
  venueId: string;
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
}

interface OrderState {
  activeOrder?: OrderRecord;
  history: OrderRecord[];
  setActiveOrder: (order?: OrderRecord) => void;
  addToHistory: (order: OrderRecord) => void;
  clearHistory: () => void;
}

// Sprint 9 placeholder stub (V2 prep): intentionally minimal and compile-safe.
export const useOrderStore = create<OrderState>()((set) => ({
  activeOrder: undefined,
  history: [],
  setActiveOrder: (activeOrder) => set({ activeOrder }),
  addToHistory: (order) =>
    set((state) => ({
      history: [order, ...state.history],
    })),
  clearHistory: () => set({ history: [] }),
}));
