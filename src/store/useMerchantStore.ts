import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  MerchantAccount,
  MerchantAnalytics,
  MerchantNotificationPreferences,
  MerchantOutlet,
  VerificationStatus,
} from "@/types/domain";
import { createAccountPersistStorage } from "./accountPersistStorage";

// ─── State ────────────────────────────────────────────────────────────────────

interface MerchantState {
  /** Current merchant account (null if user is not a merchant) */
  account: MerchantAccount | null;
  /** Last successful merchant-account sync timestamp */
  accountSyncedAt: number | null;
  /** Currently selected outlet ID for multi-outlet accounts */
  activeOutletId: string | null;
  /** Cached analytics for the active outlet */
  analyticsCache: MerchantAnalytics | null;
  /** Notification preferences */
  notificationPreferences: MerchantNotificationPreferences;
  /** Dev-only bypass used by the launcher to open merchant tools without the sign-in gate */
  developerMerchantMode: boolean;
}

interface MerchantActions {
  setAccount: (account: MerchantAccount | null) => void;
  setActiveOutlet: (outletId: string) => void;
  setVerificationStatus: (outletId: string, status: VerificationStatus) => void;
  updateOutletProfile: (outletId: string, updates: Partial<MerchantOutlet>) => void;
  setAnalyticsCache: (analytics: MerchantAnalytics | null) => void;
  setNotificationPreferences: (prefs: Partial<MerchantNotificationPreferences>) => void;
  setDeveloperMerchantMode: (enabled: boolean) => void;
  clearMerchant: () => void;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_NOTIFICATION_PREFS: MerchantNotificationPreferences = {
  newReviews: true,
  lowRatingAlerts: true,
  newComments: true,
  promotionUpdates: true,
  weeklyDigest: true,
  aiInsights: true,
};

const INITIAL_STATE: MerchantState = {
  account: null,
  accountSyncedAt: null,
  activeOutletId: null,
  analyticsCache: null,
  notificationPreferences: DEFAULT_NOTIFICATION_PREFS,
  developerMerchantMode: false,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useMerchantStore = create<MerchantState & MerchantActions>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      setAccount: (account) =>
        set((state) => {
          const activeOutletStillExists =
            account?.outlets.some((outlet) => outlet.id === state.activeOutletId) ?? false;
          return {
            account,
            accountSyncedAt: account ? Date.now() : null,
            activeOutletId: activeOutletStillExists
              ? state.activeOutletId
              : (account?.outlets[0]?.id ?? null),
          };
        }),

      setActiveOutlet: (outletId) => set({ activeOutletId: outletId, analyticsCache: null }),

      setVerificationStatus: (outletId, status) =>
        set((state) => {
          if (!state.account) return state;
          return {
            account: {
              ...state.account,
              outlets: state.account.outlets.map((o) =>
                o.id === outletId ? { ...o, verification: { ...o.verification, status } } : o,
              ),
            },
          };
        }),

      updateOutletProfile: (outletId, updates) =>
        set((state) => {
          if (!state.account) return state;
          return {
            account: {
              ...state.account,
              outlets: state.account.outlets.map((o) =>
                o.id === outletId ? { ...o, ...updates } : o,
              ),
            },
          };
        }),

      setAnalyticsCache: (analytics) => set({ analyticsCache: analytics }),

      setNotificationPreferences: (prefs) =>
        set((state) => ({
          notificationPreferences: {
            ...state.notificationPreferences,
            ...prefs,
          },
        })),

      setDeveloperMerchantMode: (enabled) => set({ developerMerchantMode: enabled }),

      clearMerchant: () => set(INITIAL_STATE),
    }),
    {
      name: "hungry-merchant-v1",
      storage: createAccountPersistStorage("hungry-merchant-v1"),
      partialize: (state) => ({
        account: state.account,
        accountSyncedAt: state.accountSyncedAt,
        activeOutletId: state.activeOutletId,
        notificationPreferences: state.notificationPreferences,
      }),
    },
  ),
);

// ─── Selectors ────────────────────────────────────────────────────────────────

/** Get the currently active outlet from the merchant account */
export function getActiveOutlet(state: MerchantState): MerchantOutlet | undefined {
  if (!state.account || !state.activeOutletId) return undefined;
  return state.account.outlets.find((o) => o.id === state.activeOutletId);
}

/** Check if the active outlet is verified */
export function isActiveOutletVerified(state: MerchantState): boolean {
  const outlet = getActiveOutlet(state);
  return outlet?.verification.status === "verified";
}

/** Check if the user has a merchant account */
export function isMerchant(state: MerchantState): boolean {
  return state.account !== null;
}
