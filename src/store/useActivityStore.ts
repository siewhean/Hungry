import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  getActivityReadKey,
  getActivityUnreadCount,
  type ActivityUpdate,
  type ActivityItemType,
  type ActivityChatMessage,
  type SharedPostPayload,
} from "@/features/home/activity";
import { getHungryService } from "@/lib/services/serviceProvider";

import { hungryPersistStorage } from "./persistStorage";

interface ActivityState {
  readActivityIds: string[];
  sharedPostMessages: Record<string, ActivityChatMessage[]>;
  activityUpdates: ActivityUpdate[];
  markActivityRead: (type: ActivityItemType, id: string) => void;
  isActivityUnread: (type: ActivityItemType, id: string, initialUnread?: boolean) => boolean;
  getUnreadCount: () => number;
  sharePostToChat: (chatId: string, post: SharedPostPayload) => Promise<void>;
  addActivityUpdate: (update: Omit<ActivityUpdate, "id">) => void;
}

export const useActivityStore = create<ActivityState>()(
  persist(
    (set, get) => ({
      readActivityIds: [],
      sharedPostMessages: {},
      activityUpdates: [],
      markActivityRead: (type, id) => {
        const readKey = getActivityReadKey(type, id);
        set((state) =>
          state.readActivityIds.includes(readKey)
            ? state
            : { readActivityIds: [...state.readActivityIds, readKey] },
        );
      },
      isActivityUnread: (type, id, initialUnread = false) =>
        initialUnread && !get().readActivityIds.includes(getActivityReadKey(type, id)),
      getUnreadCount: () => getActivityUnreadCount(get().readActivityIds, get().activityUpdates),
      addActivityUpdate: (update) => {
        set((state) => ({
          activityUpdates: [
            ...state.activityUpdates,
            {
              id: `${update.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              ...update,
              unread: true,
            },
          ],
        }));
      },
      sharePostToChat: async (chatId, post) => {
        const shareBody = `Shared ${post.title}\n${post.subtitle}`;
        await getHungryService().chat.sendMessage({
          conversationId: chatId,
          body: shareBody,
          clientNonce: `share-${post.postId}-${Date.now()}`,
        });

        const message: ActivityChatMessage = {
          id: `shared-${post.postId}-${Date.now()}`,
          text: shareBody,
          sent: true,
          createdAt: "now",
          sharedPost: post,
        };

        set((state) => ({
          sharedPostMessages: {
            ...state.sharedPostMessages,
            [chatId]: [...(state.sharedPostMessages[chatId] ?? []), message],
          },
        }));
      },
    }),
    {
      name: "hungry-activity-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({
        readActivityIds: state.readActivityIds,
        sharedPostMessages: state.sharedPostMessages,
      }),
    },
  ),
);
