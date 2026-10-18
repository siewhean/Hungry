/**
 * useStallFollowStore — stalls the signed-in user follows.
 *
 * Following a stall is what makes the user eligible for opt-in push alerts
 * when that stall's merchant adds a dish, changes a price, or brings an item
 * back in stock. Optimistic: the UI flips first and rolls back on failure.
 */

import { create } from "zustand";

import { trackAnalyticsEvent } from "@/lib/analytics";
import { getHungryService } from "@/lib/services/serviceProvider";

interface StallFollowState {
  followedStallIds: string[];
  isLoaded: boolean;
  loadFollowedStalls: () => Promise<void>;
  isFollowing: (stallId: string) => boolean;
  toggleFollow: (stallId: string) => Promise<boolean>;
  _reset: () => void;
}

export const useStallFollowStore = create<StallFollowState>()((set, get) => ({
  followedStallIds: [],
  isLoaded: false,

  loadFollowedStalls: async () => {
    const followedStallIds = await getHungryService().profile.getFollowedStallIds();
    set({ followedStallIds, isLoaded: true });
  },

  isFollowing: (stallId) => get().followedStallIds.includes(stallId),

  toggleFollow: async (stallId) => {
    const previous = get().followedStallIds;
    const following = !previous.includes(stallId);
    set({
      followedStallIds: following
        ? [...previous, stallId]
        : previous.filter((id) => id !== stallId),
    });
    try {
      await getHungryService().profile.setStallFollow(stallId, following);
    } catch (error) {
      set({ followedStallIds: previous });
      throw error;
    }
    trackAnalyticsEvent(following ? "stall_followed" : "stall_unfollowed", { stall_id: stallId });
    return following;
  },

  _reset: () => set({ followedStallIds: [], isLoaded: false }),
}));
