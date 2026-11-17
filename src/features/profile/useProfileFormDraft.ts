import { useCallback, useEffect, useRef, useState } from "react";
import type { SetStateAction } from "react";
import { hungryPersistStorage } from "@/store/persistStorage";
import { useProfileStore } from "@/store/useProfileStore";

/** Draft keys are partitioned by account; writes are serialized behind hydration. */
export function useProfileFormDraft<T extends object>(kind: string, initial: T) {
  const accountId = useProfileStore((state) => state.profile.id);
  const key = `hungry-profile-draft-v1:${encodeURIComponent(accountId)}:${kind}`;
  const initialRef = useRef(initial);
  initialRef.current = initial;
  const [value, setValue] = useState<T>(initial);
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [storageError, setStorageError] = useState(false);
  const cleared = useRef(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    let active = true;
    cleared.current = false;
    setReadyKey(null);
    setStorageError(false);
    setValue(initialRef.current);
    void (async () => {
      try {
        const saved = await hungryPersistStorage?.getItem(key);
        if (active && saved) {
          const parsed: unknown = saved.state;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
            setValue({ ...initialRef.current, ...parsed });
        }
      } catch {
        if (active) setStorageError(true);
      } finally {
        if (active) setReadyKey(key);
      }
    })();
    return () => {
      active = false;
    };
  }, [key]);
  useEffect(() => {
    if (readyKey !== key || cleared.current) return;
    const serialized = { state: value, version: 1 };
    queue.current = queue.current
      .catch(() => undefined)
      .then(() => hungryPersistStorage?.setItem(key, serialized))
      .catch(() => setStorageError(true));
  }, [key, readyKey, value]);
  const update = useCallback(<K extends keyof T>(field: K, next: SetStateAction<T[K]>) => {
    setValue((current) => ({
      ...current,
      [field]:
        typeof next === "function" ? (next as (previous: T[K]) => T[K])(current[field]) : next,
    }));
  }, []);
  const clear = useCallback(async () => {
    cleared.current = true;
    await queue.current.catch(() => undefined);
    await hungryPersistStorage?.removeItem(key);
  }, [key]);
  return { value, update, clear, ready: readyKey === key, storageError };
}
