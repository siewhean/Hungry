import { create } from "zustand";
import { persist } from "zustand/middleware";

import { hungryPersistStorage } from "./persistStorage";

interface DishLikeState {
  /** Dishes each diner liked, by user id, newest last. Kept on the device; Save is the synced list. */
  likedDishIdsByUser: Record<string, string[]>;
  isLiked: (userId: string, dishId: string) => boolean;
  /** Returns true when the dish is liked after the toggle. */
  toggleLike: (userId: string, dishId: string) => boolean;
}

export const useDishLikeStore = create<DishLikeState>()(
  persist(
    (set, get) => ({
      likedDishIdsByUser: {},
      isLiked: (userId, dishId) => (get().likedDishIdsByUser[userId] ?? []).includes(dishId),
      toggleLike: (userId, dishId) => {
        const current = get().likedDishIdsByUser[userId] ?? [];
        const liked = current.includes(dishId);
        set({
          likedDishIdsByUser: {
            ...get().likedDishIdsByUser,
            [userId]: liked ? current.filter((id) => id !== dishId) : [...current, dishId],
          },
        });
        return !liked;
      },
    }),
    {
      name: "hungry-dish-likes-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({ likedDishIdsByUser: state.likedDishIdsByUser }),
    },
  ),
);
