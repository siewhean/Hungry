import { create } from "zustand";
import { persist } from "zustand/middleware";

import { hungryPersistStorage } from "./persistStorage";

/** Taps on the Version row in Settings that unlock the developer tools. */
export const DEVELOPER_UNLOCK_TAPS = 7;
/** Taps further apart than this start the count again. */
export const DEVELOPER_UNLOCK_WINDOW_MS = 2000;

interface DeveloperToolsState {
  /** The hidden Developer tools are open on this device. Never shown to anyone who has not unlocked them. */
  unlocked: boolean;
  /** Version-row taps in the current run, and when the last one landed (not saved). */
  tapCount: number;
  lastTapAt: number;
  /** Counts one Version-row tap; returns true on the tap that unlocks the tools. */
  registerVersionTap: (now?: number) => boolean;
  lock: () => void;
}

export const useDeveloperToolsStore = create<DeveloperToolsState>()(
  persist(
    (set, get) => ({
      unlocked: false,
      tapCount: 0,
      lastTapAt: 0,
      registerVersionTap: (now = Date.now()) => {
        const state = get();
        if (state.unlocked) return false;
        const withinWindow = now - state.lastTapAt <= DEVELOPER_UNLOCK_WINDOW_MS;
        const tapCount = withinWindow ? state.tapCount + 1 : 1;
        if (tapCount >= DEVELOPER_UNLOCK_TAPS) {
          set({ unlocked: true, tapCount: 0, lastTapAt: 0 });
          return true;
        }
        set({ tapCount, lastTapAt: now });
        return false;
      },
      lock: () => set({ unlocked: false, tapCount: 0, lastTapAt: 0 }),
    }),
    {
      name: "hungry-developer-tools-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({ unlocked: state.unlocked }),
    },
  ),
);
