import { createStore } from "zustand/vanilla";
import type { PersistStorage } from "zustand/middleware";
import { accountDraftPersistence } from "@/features/post/accountDraftPersistence";

export type ReplyDraftState = { drafts: Record<string, string>; readyFor: string | null };
export function createMerchantReplyDraftModel(
  storage?: PersistStorage<{ drafts: Record<string, string> }>,
) {
  const store = createStore<ReplyDraftState>(() => ({ drafts: {}, readyFor: null }));
  const persistScope = accountDraftPersistence(
    store,
    "hungry-merchant-reply-drafts",
    (state) => ({ drafts: state.drafts }),
    { drafts: {} },
    storage,
  );
  let owner: string | null = null;
  let pending = Promise.resolve();
  return {
    store,
    scope(next: string | null) {
      if (next === owner) return pending;
      owner = next;
      pending = persistScope(next).then(() => {
        if (owner === next) store.setState({ readyFor: next });
      });
      return pending;
    },
    write(accountId: string, interactionId: string, text: string) {
      if (owner !== accountId || store.getState().readyFor !== accountId) return false;
      store.setState((state) => ({ drafts: { ...state.drafts, [interactionId]: text } }));
      return true;
    },
  };
}
