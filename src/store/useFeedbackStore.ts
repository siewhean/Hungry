import { create } from "zustand";
import { persist } from "zustand/middleware";

import { hungryPersistStorage } from "./persistStorage";

/** A "Was this useful?" question is not repeated for this long once answered or dismissed. */
export const PROMPT_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
/** At most one question appears in this window, wherever the person is. */
export const GLOBAL_PROMPT_GAP_MS = 24 * 60 * 60 * 1000;
/** The written feedback form takes this many sends a day. */
export const DAILY_FEEDBACK_LIMIT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

interface FeedbackState {
  /** Prompt id -> when it was last answered or dismissed (epoch ms). */
  settled: Record<string, number>;
  /** When any question last appeared (epoch ms). */
  lastShownAt: number;
  /** When written feedback was sent today, to cap sends. */
  sentAt: number[];
  canAsk: (promptId: string, now?: number) => boolean;
  markShown: (now?: number) => void;
  markSettled: (promptId: string, now?: number) => void;
  canSendFeedback: (now?: number) => boolean;
  markFeedbackSent: (now?: number) => void;
}

export const useFeedbackStore = create<FeedbackState>()(
  persist(
    (set, get) => ({
      settled: {},
      lastShownAt: 0,
      sentAt: [],
      canAsk: (promptId, now = Date.now()) => {
        const { settled, lastShownAt } = get();
        const answeredAt = settled[promptId];
        if (answeredAt !== undefined && now - answeredAt < PROMPT_COOLDOWN_MS) return false;
        return now - lastShownAt >= GLOBAL_PROMPT_GAP_MS;
      },
      markShown: (now = Date.now()) => set({ lastShownAt: now }),
      markSettled: (promptId, now = Date.now()) =>
        set((state) => ({ settled: { ...state.settled, [promptId]: now } })),
      canSendFeedback: (now = Date.now()) =>
        get().sentAt.filter((at) => now - at < DAY_MS).length < DAILY_FEEDBACK_LIMIT,
      markFeedbackSent: (now = Date.now()) =>
        set((state) => ({
          sentAt: [...state.sentAt.filter((at) => now - at < DAY_MS), now],
        })),
    }),
    {
      name: "hungry-feedback-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({
        settled: state.settled,
        lastShownAt: state.lastShownAt,
        sentAt: state.sentAt,
      }),
    },
  ),
);
