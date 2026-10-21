import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  getActivityReadKey,
  getActivityUnreadCount,
  mapActivityEventToUpdate,
  selectActivitySourceUpdates,
  type ActivityUpdate,
  type ActivityItemType,
  type ActivityChatMessage,
  type SharedPostPayload,
} from "@/features/home/activity";
import { getHungryService, getServiceProvider } from "@/lib/services/serviceProvider";
import { webShareUrl } from "@/constants/links";

import { hungryPersistStorage } from "./persistStorage";

/** Inbox rows per read; "Show older updates" loads the next page. */
export const ACTIVITY_PAGE_SIZE = 50;
/** Local read marks kept (mock and local-only updates); server events use read_at. */
const READ_ACTIVITY_ID_LIMIT = 500;

/** Shows a toast without importing the UI store at module load. */
function showActivityToast(message: string) {
  const { useUIStore } = require("./useUIStore") as typeof import("./useUIStore");
  useUIStore.getState().showToast({ message, tone: "error" });
}

interface ActivityState {
  readActivityIds: string[];
  sharedPostMessages: Record<string, ActivityChatMessage[]>;
  activityUpdates: ActivityUpdate[];
  dbActivityEvents: ActivityUpdate[];
  /** True once a server read has finished (ok or not): the inbox can stop its first-load state. */
  hasLoadedActivity: boolean;
  /** The last server read failed; the list above is the last good one. */
  activityLoadFailed: boolean;
  /** The last page was full, so older updates may exist. */
  hasMoreActivity: boolean;
  isLoadingMoreActivity: boolean;
  markActivityRead: (type: ActivityItemType, id: string) => void;
  markAllActivityRead: () => Promise<void>;
  fetchMoreActivityEvents: () => Promise<void>;
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
      hasLoadedActivity: false,
      activityLoadFailed: false,
      hasMoreActivity: false,
      isLoadingMoreActivity: false,
      clearAccountScopedState: () =>
        set({
          readActivityIds: [],
          sharedPostMessages: {},
          activityUpdates: [],
          dbActivityEvents: [],
          hasLoadedActivity: false,
          activityLoadFailed: false,
          hasMoreActivity: false,
          isLoadingMoreActivity: false,
        }),
      markActivityRead: (type, id) => {
        const isServerEvent =
          type === "update" && get().dbActivityEvents.some((event) => event.id === id);
        if (isServerEvent) {
          // The server's read_at is the record: nothing to remember on the device.
          set((state) => ({
            dbActivityEvents: state.dbActivityEvents.map((event) =>
              event.id === id ? { ...event, unread: false } : event,
            ),
          }));
          if (getServiceProvider().mode !== "mock") {
            void getHungryService()
              .notifications.markActivityRead(id)
              .catch((error) => {
                console.warn("Failed to mark activity read", error);
              });
          }
          return;
        }
        const readKey = getActivityReadKey(type, id);
        set((state) =>
          state.readActivityIds.includes(readKey)
            ? state
            : {
                readActivityIds: [...state.readActivityIds, readKey].slice(-READ_ACTIVITY_ID_LIMIT),
              },
        );
      },
      markAllActivityRead: async () => {
        const mode = getServiceProvider().mode;
        const unreadLocalKeys = selectActivitySourceUpdates(mode, [], get().activityUpdates)
          .filter((update) => update.unread)
          .map((update) => getActivityReadKey("update", update.id));
        set((state) => ({
          readActivityIds: Array.from(
            new Set([...state.readActivityIds, ...unreadLocalKeys]),
          ).slice(-READ_ACTIVITY_ID_LIMIT),
          dbActivityEvents: state.dbActivityEvents.map((event) =>
            event.unread ? { ...event, unread: false } : event,
          ),
        }));
        if (mode === "mock") return;
        try {
          await getHungryService().notifications.markAllActivityRead();
        } catch (error) {
          console.warn("Failed to mark all activity read", error);
          showActivityToast("Couldn't mark updates as read. Please try again.");
          // Put back what the server still has as unread.
          await get().fetchActivityEvents();
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
          const events = await getHungryService().notifications.listActivityEvents({
            limit: ACTIVITY_PAGE_SIZE,
            offset: 0,
          });
          const mapped: ActivityUpdate[] = events.map(mapActivityEventToUpdate);
          set({
            dbActivityEvents: mapped,
            hasLoadedActivity: true,
            activityLoadFailed: false,
            hasMoreActivity: events.length >= ACTIVITY_PAGE_SIZE,
          });
        } catch (error) {
          console.warn("Failed to fetch activity events", error);
          // Keep the last good list (and its unread badge); the inbox shows a banner.
          set({ hasLoadedActivity: true, activityLoadFailed: true });
        }
      },
      fetchMoreActivityEvents: async () => {
        if (getServiceProvider().mode === "mock") return;
        if (get().isLoadingMoreActivity || !get().hasMoreActivity) return;
        set({ isLoadingMoreActivity: true });
        try {
          const events = await getHungryService().notifications.listActivityEvents({
            limit: ACTIVITY_PAGE_SIZE,
            offset: get().dbActivityEvents.length,
          });
          const mapped: ActivityUpdate[] = events.map(mapActivityEventToUpdate);
          set((state) => {
            const known = new Set(state.dbActivityEvents.map((event) => event.id));
            return {
              dbActivityEvents: [
                ...state.dbActivityEvents,
                ...mapped.filter((event) => !known.has(event.id)),
              ],
              hasMoreActivity: events.length >= ACTIVITY_PAGE_SIZE,
              isLoadingMoreActivity: false,
            };
          });
        } catch (error) {
          console.warn("Failed to load older activity events", error);
          set({ isLoadingMoreActivity: false });
          showActivityToast("Couldn't load older updates. Please try again.");
        }
      },
      sharePostToChat: async (chatId, post) => {
        // The link lets the recipient open the post; the rich card is local to the sender.
        const shareLink = post.postId ? `\n${webShareUrl("post", post.postId)}` : "";
        const shareBody = `Shared ${post.title}\n${post.subtitle}${shareLink}`;
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
