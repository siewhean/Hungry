import { create, type UseBoundStore, type StoreApi } from "zustand";
import { accountDraftPersistence } from "@/features/post/accountDraftPersistence";

type Draft = { text: string; nonce?: string };
interface ChatDraftState {
  drafts: Record<string, Draft>;
  setDraft: (key: string, text: string) => void;
  getNonce: (key: string) => string;
  clearDraft: (key: string, sentText: string) => void;
  clearAccountScopedState: () => void;
  setAccountScope: (accountId: string | null) => Promise<void>;
}
export const useChatDraftStore: UseBoundStore<StoreApi<ChatDraftState>> = create<ChatDraftState>()(
  (set, get) => ({
    drafts: {},
    setDraft: (key, text) =>
      set((state) => ({
        drafts: {
          ...state.drafts,
          [key]: state.drafts[key]?.text === text ? state.drafts[key] : { text },
        },
      })),
    getNonce: (key) => {
      const draft = get().drafts[key] ?? { text: "" };
      if (draft.nonce) return draft.nonce;
      const nonce = `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      set((state) => ({ drafts: { ...state.drafts, [key]: { ...draft, nonce } } }));
      return nonce;
    },
    clearDraft: (key, sentText) =>
      set((state) => {
        if (state.drafts[key]?.text.trim() !== sentText) return state;
        const drafts = { ...state.drafts };
        delete drafts[key];
        return { drafts };
      }),
    setAccountScope: (accountId): Promise<void> => changeChatDraftAccount(accountId),
    clearAccountScopedState: () => {
      // Switching owner detaches persistence before clearing memory; the old
      // account's unsent draft stays in its own durable partition.
      void changeChatDraftAccount(null);
      set({ drafts: {} });
    },
  }),
);
const changeChatDraftAccount: (accountId: string | null) => Promise<void> = accountDraftPersistence(
  useChatDraftStore,
  "hungry-chat-drafts-v2",
  (state) => ({ drafts: state.drafts }),
  { drafts: {} as Record<string, Draft> },
);
