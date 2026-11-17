import type { PersistStorage, StorageValue } from "zustand/middleware";
import { hungryPersistStorage } from "./persistStorage";
import { getAccountGeneration } from "@/lib/security/accountScope";

type ScopedStorageValue = StorageValue<unknown> & { accountScope?: string };
function sessionStore() {
  const { useSessionStore } = require("./useSessionStore") as typeof import("./useSessionStore");
  return useSessionStore;
}
function currentSubject(): string {
  const session = sessionStore().getState();
  return session.isAuthenticated && session.authenticatedUserId
    ? session.authenticatedUserId
    : "guest-user";
}
async function waitForSubject(): Promise<string> {
  const store = sessionStore();
  if (!store.persist.hasHydrated())
    await new Promise<void>((resolve) => {
      const off = store.persist.onFinishHydration(() => {
        off();
        resolve();
      });
      if (store.persist.hasHydrated()) {
        off();
        resolve();
      }
    });
  return currentSubject();
}
/** Cache data is never used as evidence of authorization. Every private cache
 * has a subject key and a generation guard; old global cache data is retired. */
export function createAccountPersistStorage(baseName: string): PersistStorage<unknown> {
  const key = (subject: string) => `${baseName}:account:${encodeURIComponent(subject)}`;
  return {
    async getItem() {
      const generation = getAccountGeneration();
      const subject = await waitForSubject();
      const value = (await hungryPersistStorage?.getItem(
        key(subject),
      )) as ScopedStorageValue | null;
      await hungryPersistStorage?.removeItem(baseName);
      if (
        generation !== getAccountGeneration() ||
        subject !== currentSubject() ||
        value?.accountScope !== subject
      )
        return null;
      return value;
    },
    async setItem(_name, value) {
      const subject = currentSubject();
      await hungryPersistStorage?.setItem(key(subject), {
        ...value,
        accountScope: subject,
      } as ScopedStorageValue);
    },
    async removeItem() {
      await hungryPersistStorage?.removeItem(key(currentSubject()));
    },
  };
}
