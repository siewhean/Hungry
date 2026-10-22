import { getAccountGeneration } from "@/lib/security/accountScope";
import { useProfileStore } from "@/store/useProfileStore";
import { useOnboardingDraftStore } from "./useOnboardingDraftStore";

const pending = new Map<string, Promise<void>>();
/** Desired state plus account generation makes retries and account transitions safe. */
export function fulfillPendingOnboardingSave() {
  const profileId = useProfileStore.getState().profile.id;
  const generation = getAccountGeneration();
  const draft = useOnboardingDraftStore.getState().draft;
  if (profileId === "guest-user" || draft?.subjectId !== profileId || !draft.pendingSaveDishId)
    return Promise.resolve();
  const dishId = draft.pendingSaveDishId;
  const key = `${generation}:${profileId}:${dishId}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const operation = (async () => {
    const saved = await useProfileStore.getState().setFavourite(dishId, true);
    if (generation !== getAccountGeneration()) return;
    if (!saved) throw new Error("Dish could not be saved. Try again.");
    const current = useOnboardingDraftStore.getState().draft;
    if (current?.subjectId === profileId && current.pendingSaveDishId === dishId) {
      useOnboardingDraftStore.getState().update({ pendingSaveDishId: undefined });
    }
  })().finally(() => {
    if (pending.get(key) === operation) pending.delete(key);
  });
  pending.set(key, operation);
  return operation;
}
