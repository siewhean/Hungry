import { useEffect, useState } from "react";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import type { DishDetail, VenueSummary } from "@/types/domain";

/** Exact-ID service reads hydrate saved items even when catalog caches are cold. */
export function useResolvedProfileEntities(ids: string[], kind: "dish" | "venue") {
  const accountId = useProfileStore((state) => state.profile.id);
  const key = JSON.stringify([...new Set(ids)]);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    items: (DishDetail | VenueSummary)[];
    loading: boolean;
    failed: number;
    missing: number;
  }>({ items: [], loading: true, failed: 0, missing: 0 });
  useEffect(() => {
    let active = true;
    setState({ items: [], loading: true, failed: 0, missing: 0 });
    const selectedIds = JSON.parse(key) as string[];
    const discovery = getHungryService().discovery;
    void Promise.allSettled(
      selectedIds.map((id) => (kind === "dish" ? discovery.getDish(id) : discovery.getVenue(id))),
    ).then((results) => {
      if (!active) return;
      const items: (DishDetail | VenueSummary)[] = [];
      let failed = 0;
      let missing = 0;
      for (const result of results) {
        if (result.status === "rejected") failed += 1;
        else if (result.value) items.push(result.value);
        else missing += 1;
      }
      setState({ items, loading: false, failed, missing });
    });
    return () => {
      active = false;
    };
  }, [key, kind, accountId, attempt]);
  return { ...state, retry: () => setAttempt((value) => value + 1) };
}
