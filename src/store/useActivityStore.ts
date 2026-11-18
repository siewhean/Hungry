import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  getActivityReadKey,
  getActivityUnreadCount,
  mapActivityEventToUpdate,
  selectActivitySourceUpdates,
  type ActivityUpdate,
  type ActivityItemType,
} from "@/features/home/activity";
import { getHungryService, getServiceProvider } from "@/lib/services/serviceProvider";

import { hungryPersistStorage } from "./persistStorage";
import { reportError } from "@/lib/monitoring/reportError";

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
  addActivityUpdate: (update: Omit<ActivityUpdate, "id">) => void;
  fetchActivityEvents: () => Promise<void>;
  clearAccountScopedState: () => void;
}

export const useActivityStore = create<ActivityState>()(
  persist(
    (set, get) => ({
      readActivityIds: [],
      activityUpdates: [],
      dbActivityEvents: [],
      hasLoadedActivity: false,
      activityLoadFailed: false,
      hasMoreActivity: false,
      isLoadingMoreActivity: false,
      clearAccountScopedState: () =>
        set({
          readActivityIds: [],
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
                reportError(error, { screen: "activity_store", action: "mark_activity_read" });
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
          reportError(error, { screen: "activity_store", action: "mark_all_activity_read" });
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
          reportError(error, { screen: "activity_store", action: "fetch_activity_events" });
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
          reportError(error, { screen: "activity_store", action: "load_older_activity_events" });
          set({ isLoadingMoreActivity: false });
          showActivityToast("Couldn't load older updates. Please try again.");
        }
      },
    }),
    {
      name: "hungry-activity-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({
        readActivityIds: state.readActivityIds,
      }),
    },
  ),
);
