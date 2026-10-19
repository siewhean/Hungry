import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  MerchantAccount,
  MerchantAnalytics,
  MerchantNotificationPreferences,
  MerchantOutlet,
  VerificationStatus,
} from "@/types/domain";
import { hungryPersistStorage } from "./persistStorage";

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
  /**
   * True only while the user is in the Merchant Centre. Having an account makes the user a
   * merchant; this flag is the current mode. Persisted so a merchant reopens where they left off,
   * but on launch it only becomes `merchantModeRestore` until the session confirms the account.
   */
  merchantModeActive: boolean;
  /**
   * Launch-time restore of a remembered Merchant mode. "checking": waiting for the session and
   * merchant account; "restore": open the Merchant Centre; "none": open customer mode.
   */
  merchantModeRestore: MerchantModeRestore;
}

export type MerchantModeRestore = "checking" | "restore" | "none";

interface MerchantActions {
  setAccount: (account: MerchantAccount | null) => void;
  setActiveOutlet: (outletId: string) => void;
  setVerificationStatus: (outletId: string, status: VerificationStatus) => void;
  updateOutletProfile: (outletId: string, updates: Partial<MerchantOutlet>) => void;
  setAnalyticsCache: (analytics: MerchantAnalytics | null) => void;
  setNotificationPreferences: (prefs: Partial<MerchantNotificationPreferences>) => void;
  setDeveloperMerchantMode: (enabled: boolean) => void;
  setMerchantModeActive: (active: boolean) => void;
  resolveMerchantModeRestore: (hasMerchantAccount: boolean) => void;
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
  merchantModeActive: false,
  merchantModeRestore: "none",
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useMerchantStore = create<MerchantState & MerchantActions>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,
      // Unknown until the persisted flag is read; launch waits rather than guessing.
      merchantModeRestore: "checking",

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

      // Entering or leaving the Merchant Centre settles any pending launch restore.
      setMerchantModeActive: (active) =>
        set({ merchantModeActive: active, merchantModeRestore: "none" }),

      resolveMerchantModeRestore: (hasMerchantAccount) =>
        set((state) =>
          state.merchantModeRestore === "checking"
            ? { merchantModeRestore: hasMerchantAccount ? "restore" : "none" }
            : state,
        ),

      clearMerchant: () => set(INITIAL_STATE),
    }),
    {
      name: "hungry-merchant-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({
        account: state.account,
        accountSyncedAt: state.accountSyncedAt,
        activeOutletId: state.activeOutletId,
        notificationPreferences: state.notificationPreferences,
        // Keep remembering Merchant mode until the launch route has opened the Merchant Centre.
        merchantModeActive: state.merchantModeActive || state.merchantModeRestore === "restore",
      }),
      // A remembered Merchant mode is not active on launch: it waits for the session to confirm
      // the merchant account, then the launch route opens the Merchant Centre (which activates it).
      merge: (persistedState, currentState) => {
        const { merchantModeActive: rememberedMerchantMode, ...persisted } = (persistedState ??
          {}) as Partial<MerchantState>;
        return {
          ...currentState,
          ...persisted,
          merchantModeActive: false,
          merchantModeRestore: rememberedMerchantMode === true ? "checking" : "none",
        };
      },
      onRehydrateStorage: () => (_state, error) => {
        if (error) useMerchantStore.setState({ merchantModeRestore: "none" });
      },
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

/** Check if the user is currently in merchant mode (a merchant who has entered the Merchant Centre) */
export function isMerchantModeActive(state: MerchantState): boolean {
  return state.merchantModeActive && state.account !== null;
}
