import { create } from "zustand";
import { persist } from "zustand/middleware";

import { hungryPersistStorage } from "./persistStorage";

interface ConsentState {
  /**
   * This device has an answer to "Share usage analytics?". The answer itself is
   * `useUIStore.analyticsEnabled`; until it is asked, a new install sends no analytics.
   */
  analyticsAsked: boolean;
  /** The signed-in account allows AI search (typed text sent to Anthropic). Copied from the account. */
  aiSearchAllowed: boolean;
  /** The account's answers have been read this session (not saved: read again at each sign-in). */
  accountChecked: boolean;
  /** The "sent to Anthropic" notice is open; `answer` settles the caller waiting on it. */
  aiSearchNotice: { answer: (allowed: boolean) => void } | null;
  setAnalyticsAsked: (asked: boolean) => void;
  setAiSearchAllowed: (allowed: boolean) => void;
  setAccountChecked: (checked: boolean) => void;
  openAiSearchNotice: (answer: (allowed: boolean) => void) => void;
  closeAiSearchNotice: () => void;
}

export const useConsentStore = create<ConsentState>()(
  persist(
    (set) => ({
      analyticsAsked: false,
      aiSearchAllowed: false,
      accountChecked: false,
      aiSearchNotice: null,
      setAnalyticsAsked: (analyticsAsked) => set({ analyticsAsked }),
      setAiSearchAllowed: (aiSearchAllowed) => set({ aiSearchAllowed }),
      setAccountChecked: (accountChecked) => set({ accountChecked }),
      openAiSearchNotice: (answer) => set({ aiSearchNotice: { answer } }),
      closeAiSearchNotice: () => set({ aiSearchNotice: null }),
    }),
    {
      name: "hungry-consent-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({
        analyticsAsked: state.analyticsAsked,
        aiSearchAllowed: state.aiSearchAllowed,
      }),
    },
  ),
);
