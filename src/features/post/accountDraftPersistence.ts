import type { StoreApi } from "zustand";
import type { PersistStorage } from "zustand/middleware";
import { hungryPersistStorage } from "@/store/persistStorage";

/** Subject partitioning with generation and edit guards for delayed storage reads. */
export function accountDraftPersistence<S extends object, P extends Partial<S>>(
  store: StoreApi<S>,
  name: string,
  select: (state: S) => P,
  empty: P,
  storage = hungryPersistStorage as PersistStorage<P> | undefined,
) {
  let owner: string | null = null;
  let generation = 0;
  let revision = 0;
  let hydrating = false;
  const writes = new Map<string, Promise<void>>();
  store.subscribe((state) => {
    if (hydrating || !owner || !storage) return;
    revision += 1;
    const key = `${name}:${encodeURIComponent(owner)}`;
    const snapshot = select(state);
    const write = (writes.get(key) ?? Promise.resolve())
      .catch(() => {})
      .then(async () => {
        await storage.setItem(key, { state: snapshot, version: 2 });
      });
    writes.set(key, write);
    void write.catch(() => {});
  });
  return async (next: string | null) => {
    if (next === owner) return;
    owner = next;
    const current = ++generation;
    hydrating = true;
    store.setState(empty);
    hydrating = false;
    const editedAt = revision;
    if (!next || !storage) return;
    const key = `${name}:${encodeURIComponent(next)}`;
    await writes.get(key)?.catch(() => {});
    try {
      const saved = await storage.getItem(key);
      if (current !== generation || editedAt !== revision || !saved) return;
      hydrating = true;
      store.setState(saved.state);
    } finally {
      hydrating = false;
    }
  };
}
