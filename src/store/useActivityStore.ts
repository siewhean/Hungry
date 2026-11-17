import { webShareUrl } from "@/constants/links";
import { useProfileStore } from "./useProfileStore";
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

import { createAccountPersistStorage } from "./accountPersistStorage";

let activityGeneration = 0;
const pendingShares = new Map<string, string>();

interface ActivityState {
  isLoading: boolean;
  error: string | null;
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
      isLoading: false,
      error: null,
      readActivityIds: [],
      sharedPostMessages: {},
      activityUpdates: [],
      dbActivityEvents: [],
      clearAccountScopedState: () => {
        activityGeneration++;
        pendingShares.clear();
        set({
          isLoading: false,
          error: null,
          readActivityIds: [],
          sharedPostMessages: {},
          activityUpdates: [],
          dbActivityEvents: [],
        });
      },
      markActivityRead: (type, id) => {
        const generation = activityGeneration;
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
              if (generation !== activityGeneration) return;
              set((state) => ({
                error: "Could not mark activity as read. Retry to refresh.",
                readActivityIds: state.readActivityIds.filter((key) => key !== readKey),
                dbActivityEvents: state.dbActivityEvents.map((event) =>
                  event.id === id ? { ...event, unread: true } : event,
                ),
              }));
            });
        }
      },
      isActivityUnread: (type, id, initialUnread = false) =>
        initialUnread && !get().readActivityIds.includes(getActivityReadKey(type, id)),
      getUnreadCount: () =>
        getActivityUnreadCount(
          get().readActivityIds,
          [...get().dbActivityEvents, ...get().activityUpdates],
          useProfileStore.getState().profile.id,
        ),
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
        const generation = ++activityGeneration;
        const accountId = useProfileStore.getState().profile.id;
        set({ isLoading: true, error: null });
        try {
          const events = await getHungryService().notifications.listActivityEvents();
          const mapped: ActivityUpdate[] = events.map((e) => ({
            id: e.id,
            kind:
              e.eventType === "new_like"
                ? "like"
                : e.eventType === "new_follower"
                  ? "follow"
                  : "comment",
            postId: e.targetType === "post" ? e.targetId : "",
            actorId: e.actorId,
            recipientUserId: accountId,
            targetType: e.targetType,
            targetId: e.targetId,
            actorName: e.actorName,
            text:
              e.eventType === "new_like"
                ? "liked your post"
                : e.eventType === "new_comment"
                  ? "commented on your post"
                  : e.eventType === "new_reply"
                    ? "replied to your comment"
                    : "started following you",
            target: e.targetId,
            time: e.createdAt,
            unread: !e.readAt,
          }));
          if (
            generation !== activityGeneration ||
            accountId !== useProfileStore.getState().profile.id
          )
            return;
          set({ dbActivityEvents: mapped, isLoading: false });
        } catch (error) {
          if (generation !== activityGeneration) return;
          set({ error: "Activity could not be refreshed. Retry to update.", isLoading: false });
        }
      },
      sharePostToChat: async (chatId, post) => {
        const generation = activityGeneration;
        const key = `${useProfileStore.getState().profile.id}:${chatId}:${post.postId}`;
        const nonce =
          pendingShares.get(key) ??
          `share-${post.postId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        pendingShares.set(key, nonce);
        const shareBody = `Shared ${post.title}\n${post.subtitle}\n${webShareUrl("post", post.postId)}`;
        await getHungryService().chat.sendMessage({
          conversationId: chatId,
          body: shareBody,
          clientNonce: nonce,
        });

        if (generation !== activityGeneration) return;
        pendingShares.delete(key);
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
      storage: createAccountPersistStorage("hungry-activity-v1"),
      partialize: (state) => ({
        readActivityIds: state.readActivityIds,
        sharedPostMessages: state.sharedPostMessages,
      }),
    },
  ),
);
