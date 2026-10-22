import type { PersistStorage, StorageValue } from "zustand/middleware";
import { hungryPersistStorage } from "@/store/persistStorage";
import { getAccountGeneration } from "@/lib/security/accountScope";

type OwnedDraft = { subjectId: string };
type Snapshot<T> = { draft: T | null };
const canonicalSubject = (subject: string) => (subject === "guest" ? "guest-user" : subject);
async function restoredSubject(): Promise<string> {
  const { useSessionStore } =
    require("@/store/useSessionStore") as typeof import("@/store/useSessionStore");
  if (!useSessionStore.persist.hasHydrated())
    await new Promise<void>((resolve) => {
      const stop = useSessionStore.persist.onFinishHydration(() => {
        stop();
        resolve();
      });
      if (useSessionStore.persist.hasHydrated()) {
        stop();
        resolve();
      }
    });
  const session = useSessionStore.getState();
  return session.isAuthenticated && session.authenticatedUserId
    ? session.authenticatedUserId
    : "guest-user";
}
export function createOnboardingDraftStorage<T extends OwnedDraft>(
  backing = hungryPersistStorage as PersistStorage<Snapshot<T>> | undefined,
  resolveSubject: () => Promise<string> = restoredSubject,
) {
  const legacy = "hungry-onboarding-draft-v1";
  const key = (subject: string) => `hungry-onboarding-draft-v2:${encodeURIComponent(subject)}`;
  let revision = 0;
  const writes = new Map<string, Promise<void>>();
  function enqueue(subject: string, run: () => Promise<void>) {
    const next = (writes.get(subject) ?? Promise.resolve()).catch(() => {}).then(run);
    writes.set(subject, next);
    void next.catch(() => {});
    return next;
  }
  async function load(subject: string) {
    subject = canonicalSubject(subject);
    const generation = getAccountGeneration();
    const editedAt = revision;
    await writes.get(subject)?.catch(() => {});
    const isCurrent = () => generation === getAccountGeneration() && editedAt === revision;
    let value = await backing?.getItem(key(subject));
    if (!isCurrent()) return { current: false, draft: null };
    if (!value && subject === "guest-user") {
      const guestAlias = await backing?.getItem(key("guest"));
      if (!isCurrent()) return { current: false, draft: null };
      if (guestAlias?.state.draft?.subjectId === "guest") {
        value = {
          ...guestAlias,
          state: { draft: { ...guestAlias.state.draft, subjectId: "guest-user" } },
        };
        await backing?.setItem(key(subject), value);
        await backing?.removeItem(key("guest"));
      }
    }
    if (!value) {
      const old = await backing?.getItem(legacy);
      if (!isCurrent()) return { current: false, draft: null };
      const legacyOwner = old?.state.draft?.subjectId
        ? canonicalSubject(old.state.draft.subjectId)
        : undefined;
      const normalizedOld =
        old?.state.draft && legacyOwner
          ? { ...old, state: { draft: { ...old.state.draft, subjectId: legacyOwner } } }
          : old;
      if (legacyOwner) {
        const existing = await backing?.getItem(key(legacyOwner));
        if (!isCurrent()) return { current: false, draft: null };
        if (!existing) await backing?.setItem(key(legacyOwner), normalizedOld!);
        if (legacyOwner === subject) value = normalizedOld;
      }
    }
    if (!isCurrent()) return { current: false, draft: null };
    await backing?.removeItem(legacy);
    const current = generation === getAccountGeneration() && editedAt === revision;
    return {
      current,
      draft: current && value?.state.draft?.subjectId === subject ? value.state.draft : null,
    };
  }
  const storage: PersistStorage<Snapshot<T>> = {
    async getItem() {
      const generation = getAccountGeneration();
      const editedAt = revision;
      const subject = await resolveSubject();
      if (generation !== getAccountGeneration() || editedAt !== revision) return null;
      const result = await load(subject);
      return result.current && result.draft ? { state: { draft: result.draft }, version: 0 } : null;
    },
    async setItem(_name, value) {
      revision++;
      const draft = value.state.draft
        ? { ...value.state.draft, subjectId: canonicalSubject(value.state.draft.subjectId) }
        : null;
      // Clearing in-memory account state must never erase another owner's saved draft.
      if (!draft) return;
      const snapshot = JSON.parse(JSON.stringify({ ...value, state: { draft } })) as StorageValue<
        Snapshot<T>
      >;
      await enqueue(draft.subjectId, async () => {
        await backing?.setItem(key(draft.subjectId), snapshot);
      });
    },
    async removeItem() {
      await remove(await resolveSubject());
    },
  };
  function remove(subject: string) {
    subject = canonicalSubject(subject);
    revision++;
    return enqueue(subject, async () => {
      await backing?.removeItem(key(subject));
      await backing?.removeItem(legacy);
    });
  }
  return { storage, load, remove };
}
