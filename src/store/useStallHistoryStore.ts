import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  applyStallSignal,
  type SentStallSignal,
  type UserStallAffinity,
} from "@/lib/ai/stallHistory";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";

import { hungryPersistStorage } from "./persistStorage";

interface StallHistoryState {
  /** Server rows plus this device's not-yet-loaded signals. */
  rows: UserStallAffinity[];
  /** The account the rows belong to ("" for a guest); a different account starts empty. */
  ownerId: string;
  /** Settings: while paused, views and opened reviews are not counted. Actions still are. */
  viewHistoryPaused: boolean;
  load: (ownerId: string) => Promise<void>;
  /** Counts one signal here at once and sends it (best effort). Paused views are dropped. */
  record: (venueId: string, signal: SentStallSignal, now?: number) => void;
  setViewHistoryPaused: (paused: boolean) => void;
  reset: () => Promise<void>;
}

const PASSIVE_SIGNALS: ReadonlySet<SentStallSignal> = new Set(["view", "review_opened"]);

/** Which stalls the diner keeps coming back to. Private: used only to rank their own Home. */
export const useStallHistoryStore = create<StallHistoryState>()(
  persist(
    (set, get) => ({
      rows: [],
      ownerId: "",
      viewHistoryPaused: false,
      load: async (ownerId) => {
        if (get().ownerId !== ownerId) set({ rows: [], ownerId });
        try {
          const serverRows = await getHungryService().recommendations.getStallHistory();
          if (get().ownerId !== ownerId) return;
          if (serverRows.length === 0 && !ownerId) return;
          // Server rows win per stall; local rows fill stalls the server has not counted yet.
          const merged = new Map(get().rows.map((row) => [row.venueId, row]));
          for (const row of serverRows) merged.set(row.venueId, row);
          set({ rows: [...merged.values()] });
        } catch (error) {
          reportError(error, { screen: "stall_history_store", action: "load_stall_history" });
        }
      },
      record: (venueId, signal, now = Date.now()) => {
        if (!venueId) return;
        if (get().viewHistoryPaused && PASSIVE_SIGNALS.has(signal)) return;
        set((state) => ({
          rows: [
            applyStallSignal(
              state.rows.find((row) => row.venueId === venueId),
              venueId,
              signal,
              now,
            ),
            ...state.rows.filter((row) => row.venueId !== venueId),
          ],
        }));
        void getHungryService()
          .recommendations.recordStallSignal(venueId, signal)
          .catch((error: unknown) =>
            reportError(error, { screen: "stall_history_store", action: "record_stall_signal" }),
          );
      },
      setViewHistoryPaused: (paused) => {
        set({ viewHistoryPaused: paused });
        trackAnalyticsEvent("view_history_paused_changed", { paused });
      },
      reset: async () => {
        await getHungryService().recommendations.resetStallHistory();
        set({ rows: [] });
      },
    }),
    {
      name: "hungry-stall-history-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({
        rows: state.rows,
        ownerId: state.ownerId,
        viewHistoryPaused: state.viewHistoryPaused,
      }),
    },
  ),
);
