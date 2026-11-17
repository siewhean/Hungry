import { useStore } from "zustand";
import { useProfileStore } from "@/store/useProfileStore";
import { createMerchantReplyDraftModel, type ReplyDraftState } from "./replyDraftModel";
const model = createMerchantReplyDraftModel();
export function useMerchantReplyDraftStore<T>(select: (state: ReplyDraftState) => T) {
  return useStore(model.store, select);
}
export const scopeMerchantReplyDrafts = model.scope;
export const writeMerchantReplyDraft = model.write;
useProfileStore.subscribe((state) => {
  void scopeMerchantReplyDrafts(state.profile.id === "guest-user" ? null : state.profile.id).catch(
    () => {},
  );
});
