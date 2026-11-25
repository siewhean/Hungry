import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  catalogNow,
  consumeCatalogTap,
  recordCatalogPaint,
} from "@/lib/monitoring/catalogPerformance";

type Milestone = "actionable" | "menu" | "image";
type Outcome = NonNullable<Parameters<typeof recordCatalogPaint>[3]>;
type Layout = { id: string; outcome: "success" | "stale" | "empty" };

/** Report the first terminal result for each milestone of a focused detail open. */
export function useDetailPaint(surface: "dish" | "stall", id: string) {
  const focused = useIsFocused();
  const [header, setHeader] = useState<Layout>();
  const [menu, setMenu] = useState<Layout>();
  const attempt = useRef<{
    id: string;
    startedAt?: number;
    origin?: "tap" | "focus";
    recorded: Set<Milestone>;
    pending?: { milestone: Milestone; outcome: Outcome };
  }>({ id, recorded: new Set() });
  useEffect(() => {
    if (attempt.current.id !== id || (!focused && attempt.current.startedAt !== undefined)) {
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
    if (focused && header?.id === id) report("actionable", header.outcome);
  }, [focused, header, id, report]);

  useEffect(() => {
    if (focused && menu?.id === id) report("menu", menu.outcome);
  }, [focused, id, menu, report]);

  return {
    headerLayout: (stale = false) => {
      const outcome = stale ? "stale" : "success";
      setHeader((current) =>
        current?.id === id && current.outcome === outcome ? current : { id, outcome },
      );
    },
    imageDisplayed: () => {
      if (focused) report("image", "success");
    },
    menuLayout: (empty: boolean, stale = false) => {
      const outcome = stale ? "stale" : empty ? "empty" : "success";
      setMenu((current) =>
        current?.id === id && current.outcome === outcome ? current : { id, outcome },
      );
    },
    report,
  };
}
