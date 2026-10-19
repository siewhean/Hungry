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
import { getHungryService, getServiceProvider } from "@/lib/services/serviceProvider";

import { hungryPersistStorage } from "./persistStorage";

interface ActivityState {
  readActivityIds: string[];
  sharedPostMessages: Record<string, ActivityChatMessage[]>;
  activityUpdates: ActivityUpdate[];
  dbActivityEvents: ActivityUpdate[];
  markActivityRead: (type: ActivityItemType, id: string) => void;
  isActivityUnread: (type: ActivityItemType, id: string, initialUnread?: boolean) => boolean;
  getUnreadCount: () => number;
  sharePostToChat: (chatId: string, post: SharedPostPayload) => Promise<void>;
  addActivityUpdate: (update: Omit<ActivityUpdate, "id">) => void;
  fetchActivityEvents: () => Promise<void>;
  clearAccountScopedState: () => void;
}

export const useActivityStore = create<ActivityState>()(
  persist(
    (set, get) => ({
      readActivityIds: [],
      sharedPostMessages: {},
      activityUpdates: [],
      dbActivityEvents: [],
      clearAccountScopedState: () =>
        set({
          readActivityIds: [],
          sharedPostMessages: {},
          activityUpdates: [],
          dbActivityEvents: [],
        }),
      markActivityRead: (type, id) => {
        const readKey = getActivityReadKey(type, id);
        set((state) =>
          state.readActivityIds.includes(readKey)
            ? state
            : {
                readActivityIds: [...state.readActivityIds, readKey],
                dbActivityEvents: state.dbActivityEvents.map((event) =>
                  event.id === id ? { ...event, unread: false } : event,
                ),
              },
        );
        if (type === "update" && getServiceProvider().mode !== "mock") {
          void getHungryService()
            .notifications.markActivityRead(id)
            .catch((error) => {
              console.warn("Failed to mark activity read", error);
            });
        }
      },
      isActivityUnread: (type, id, initialUnread = false) =>
        initialUnread && !get().readActivityIds.includes(getActivityReadKey(type, id)),
      getUnreadCount: () =>
        getActivityUnreadCount(get().readActivityIds, [
          ...get().dbActivityEvents,
          ...get().activityUpdates,
        ]),
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
      fetchActivityEvents: async () => {
        if (getServiceProvider().mode === "mock") return;
        try {
          const events = await getHungryService().notifications.listActivityEvents();
          const mapped: ActivityUpdate[] = events.map((e) => ({
            id: e.id,
            kind:
              e.eventType === "new_like"
                ? "like"
                : e.eventType === "new_follower"
                  ? "share"
                  : e.eventType === "follow_request"
                    ? "follow_request"
                    : "comment",
            postId: e.targetType === "post" ? e.targetId : "",
            actorId: e.actorId,
            actorName: e.actorName,
            text:
              e.eventType === "new_like"
                ? "liked your post"
                : e.eventType === "new_comment"
                  ? "commented on your post"
                  : e.eventType === "new_reply"
                    ? "replied to your comment"
                    : e.eventType === "follow_request"
                      ? "requested to follow you"
                      : "started following you",
            target: e.eventType === "follow_request" ? "Review follow requests" : e.targetId,
            time: e.createdAt,
            unread: !e.readAt,
          }));
          set({ dbActivityEvents: mapped });
        } catch (error) {
          console.warn("Failed to fetch activity events", error);
          set({ dbActivityEvents: [] });
        }
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
