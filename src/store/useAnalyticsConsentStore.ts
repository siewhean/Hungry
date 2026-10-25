import { create } from "zustand";
import { persist } from "zustand/middleware";
import { hungryPersistStorage } from "./persistStorage";

/** Device preference; optional analytics requires an explicit opt-in. */
export const useAnalyticsConsentStore = create<{
  analyticsEnabled: boolean;
  setAnalyticsEnabled: (enabled: boolean) => void;
}>()(
  persist(
    (set) => ({
      analyticsEnabled: false,
      setAnalyticsEnabled: (analyticsEnabled) => set({ analyticsEnabled }),
    }),
    {
      name: "hungry-analytics-consent-v1",
      storage: hungryPersistStorage,
      partialize: ({ analyticsEnabled }) => ({ analyticsEnabled }),
    },
  ),
);
