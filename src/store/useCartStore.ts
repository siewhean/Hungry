import { create } from "zustand";

export interface CartItem {
  dishId: string;
  quantity: number;
  notes?: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (dishId: string) => void;
  setQuantity: (dishId: string, quantity: number) => void;
  clearCart: () => void;
}

// Sprint 9 placeholder stub (V2 prep): intentionally minimal and compile-safe.
export const useCartStore = create<CartState>()((set) => ({
  items: [],
  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((cartItem) => cartItem.dishId === item.dishId);
      if (existing) {
        return {
          items: state.items.map((cartItem) =>
            cartItem.dishId === item.dishId
              ? {
                  ...cartItem,
                  quantity: cartItem.quantity + (item.quantity ?? 1),
                  notes: item.notes ?? cartItem.notes,
                }
              : cartItem,
          ),
        };
      }
      return {
        items: [
          ...state.items,
          {
            dishId: item.dishId,
            quantity: item.quantity ?? 1,
            notes: item.notes,
          },
        ],
      };
    }),
  removeItem: (dishId) =>
    set((state) => ({
      items: state.items.filter((item) => item.dishId !== dishId),
    })),
  setQuantity: (dishId, quantity) =>
    set((state) => ({
      items:
        quantity <= 0
          ? state.items.filter((item) => item.dishId !== dishId)
          : state.items.map((item) => (item.dishId === dishId ? { ...item, quantity } : item)),
    })),
  clearCart: () => set({ items: [] }),
}));
