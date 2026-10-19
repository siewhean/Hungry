/**
 * useLifecycleStore — the signed-in user's lifecycle state for this app session.
 *
 * recordAppOpen() runs on launch and when the app returns to the foreground.
 * It calls the server at most once per Singapore day, then tags every later
 * PostHog event with lifecycle_state so funnels and retention can be split by it.
 */

import { create } from "zustand";

import { singaporeDateKey } from "@/features/lifecycle/lifecycle";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { LifecycleSnapshot } from "@/types/domain";

interface LifecycleStoreState {
  snapshot: LifecycleSnapshot | null;
  /** Singapore date the visit was last recorded for. */
  recordedDate: string | null;
  recordAppOpen: () => Promise<void>;
  reset: () => void;
}

function registerLifecycleProperty(state: LifecycleSnapshot["state"]) {
  if (
    process.env.EXPO_PUBLIC_DISABLE_POSTHOG === "1" ||
    !process.env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim()
  ) {
    return;
  }
  const { registerPostHogProperties } =
    require("@/lib/analytics/posthogSink") as typeof import("@/lib/analytics/posthogSink");
  registerPostHogProperties({ lifecycle_state: state });
}

export const useLifecycleStore = create<LifecycleStoreState>()((set, get) => ({
  snapshot: null,
  recordedDate: null,

  recordAppOpen: async () => {
    const today = singaporeDateKey();
    if (get().recordedDate === today) return;
    set({ recordedDate: today });
    try {
      const snapshot = await getHungryService().lifecycle.recordAppOpen();
      if (get().recordedDate !== today) return;
      set({ snapshot });
      if (!snapshot) return;
      registerLifecycleProperty(snapshot.state);
      trackAnalyticsEvent("lifecycle_state_recorded", {
        lifecycle_state: snapshot.state,
        days_since_previous: snapshot.daysSincePrevious,
      });
    } catch {
      // Try again on the next foreground.
      if (get().recordedDate === today) set({ recordedDate: null });
    }
  },

  reset: () => set({ snapshot: null, recordedDate: null }),
}));
