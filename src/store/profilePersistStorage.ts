import type { PersistStorage, StorageValue } from "zustand/middleware";
import { hungryPersistStorage } from "./persistStorage";
import type { UserProfile } from "@/types/domain";
import { getAccountGeneration } from "@/lib/security/accountScope";

type ProfileSnapshot = { profile?: UserProfile };
const scopedName = (subject: string) => `hungry-profile-v2:${encodeURIComponent(subject)}`;
async function restoredSubject(): Promise<string> {
  const { useSessionStore } = require("./useSessionStore") as typeof import("./useSessionStore");
  if (!useSessionStore.persist.hasHydrated())
    await new Promise<void>((resolve) => {
      const unsubscribe = useSessionStore.persist.onFinishHydration(() => {
        unsubscribe();
        resolve();
      });
      if (useSessionStore.persist.hasHydrated()) {
        unsubscribe();
        resolve();
      }
    });
  const session = useSessionStore.getState();
  return session.isAuthenticated && session.authenticatedUserId
    ? session.authenticatedUserId
    : "guest-user";
}
export const profilePersistStorage: PersistStorage<unknown> = {
  async getItem() {
    const generation = getAccountGeneration();
    const subject = await restoredSubject();
    const key = scopedName(subject);
    let value = await hungryPersistStorage?.getItem(key);
    if (!value && subject === "guest-user")
      value = await hungryPersistStorage?.getItem(scopedName("guest"));
    if (!value) {
      const legacy = await hungryPersistStorage?.getItem("hungry-profile-v1");
      const profile = (legacy?.state as ProfileSnapshot | undefined)?.profile;
      if (profile?.id === subject || (subject === "guest-user" && profile?.id === "guest")) {
        value = legacy;
        await hungryPersistStorage?.setItem(key, legacy!);
      }
      await hungryPersistStorage?.removeItem("hungry-profile-v1");
    }
    if (generation !== getAccountGeneration()) return null;
    const profile = (value?.state as ProfileSnapshot | undefined)?.profile;
    if (profile?.id === "guest" && subject === "guest-user") {
      value = {
        ...value!,
        state: { ...(value!.state as object), profile: { ...profile, id: subject } },
      };
      await hungryPersistStorage?.setItem(key, value);
      await hungryPersistStorage?.removeItem(scopedName("guest"));
      return generation === getAccountGeneration() ? (value as StorageValue<unknown>) : null;
    }
    return profile?.id === subject ? (value as StorageValue<unknown>) : null;
  },
  async setItem(_name, value) {
    const subject = (value.state as ProfileSnapshot)?.profile?.id;
    if (subject) await hungryPersistStorage?.setItem(scopedName(subject), value);
  },
  async removeItem() {
    await hungryPersistStorage?.removeItem(scopedName(await restoredSubject()));
  },
};
