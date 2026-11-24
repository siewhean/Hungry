import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  catalogNow,
  consumeCatalogTap,
  recordCatalogPaint,
} from "@/lib/monitoring/catalogPerformance";

type Milestone = "actionable" | "menu" | "image";
type Outcome = NonNullable<Parameters<typeof recordCatalogPaint>[3]>;

/** Report the first terminal result for each milestone of a focused detail open. */
export function useDetailPaint(surface: "dish" | "stall", id: string) {
  const focused = useIsFocused();
  const [layoutId, setLayoutId] = useState<string>();
  const [menuLayout, setMenuLayout] = useState<{ id: string; empty: boolean }>();
  const attempt = useRef<{
    id: string;
    startedAt?: number;
    origin?: "tap" | "focus";
    recorded: Set<Milestone>;
    pending?: { milestone: Milestone; outcome: Outcome };
  }>({ id, recorded: new Set() });
  useEffect(() => {
    if (attempt.current.id !== id) {
      attempt.current = { id, recorded: new Set() };
    }
    if (!focused) return;
    const current = attempt.current;
    if (current.startedAt === undefined) {
      const tap = consumeCatalogTap(surface, id);
      current.startedAt = tap ?? catalogNow();
      current.origin = tap === undefined ? "focus" : "tap";
    }
    if (current.pending) {
      const { milestone, outcome } = current.pending;
      current.pending = undefined;
      current.recorded.add(milestone);
      recordCatalogPaint(surface, milestone, current.startedAt, outcome, current.origin);
    }
  }, [focused, id, surface]);

  const report = useCallback(
    (milestone: Milestone, outcome: Outcome) => {
      const current = attempt.current;
      if (current.id !== id || current.recorded.has(milestone)) return;
      if (current.startedAt === undefined) {
        current.pending ??= { milestone, outcome };
        return;
      }
      current.recorded.add(milestone);
      recordCatalogPaint(surface, milestone, current.startedAt, outcome, current.origin);
    },
    [id, surface],
  );

  useEffect(() => {
    if (focused && layoutId === id) report("actionable", "success");
  }, [focused, id, layoutId, report]);

  useEffect(() => {
    if (focused && menuLayout?.id === id) report("menu", menuLayout.empty ? "empty" : "success");
  }, [focused, id, menuLayout, report]);

  return {
    headerLayout: () => setLayoutId(id),
    imageDisplayed: () => {
      if (focused) report("image", "success");
    },
    menuLayout: (empty: boolean) =>
      setMenuLayout((current) =>
        current?.id === id && current.empty === empty ? current : { id, empty },
      ),
    report,
  };
}
