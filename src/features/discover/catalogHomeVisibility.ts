import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type RefObject,
} from "react";
import type { ScrollView, View } from "react-native";

import { catalogNow, recordCatalogPaint } from "@/lib/monitoring/catalogPerformance";
import type { CatalogReadFailure } from "@/lib/services/supabase/catalogReads";

type Attempt = {
  startedAt: number;
  actionable: boolean;
  image: boolean;
};

type Observer = {
  inspect: () => void;
  observe: (node: View, image: boolean) => void;
  remove: (node: View) => void;
};

export const CatalogHomeVisibility = createContext<Observer | undefined>(undefined);

/** Native view measurements exclude rendered cards that are below the fold. */
export function useCatalogHomeVisibility({
  focused,
  scope,
  viewport,
  stale,
  terminal,
}: {
  focused: boolean;
  scope: string;
  viewport: RefObject<ScrollView | null>;
  stale: boolean;
  terminal?: CatalogReadFailure | "empty";
}): Observer {
  const candidates = useRef(new Map<View, boolean>());
  const attempt = useRef<Attempt | undefined>(undefined);
  const staleRef = useRef(stale);
  useLayoutEffect(() => {
    staleRef.current = stale;
  }, [stale]);

  const inspectSafely = useCallback(() => {
    const live = attempt.current;
    if (!live || (live.actionable && live.image) || candidates.current.size === 0) return;
    viewport.current?.getNativeScrollRef?.()?.measureInWindow?.((left, top, width, height) => {
      if (attempt.current !== live || width <= 0 || height <= 0) return;
      for (const node of candidates.current.keys()) {
        node.measureInWindow?.((x, y, nodeWidth, nodeHeight) => {
          if (
            attempt.current !== live ||
            !candidates.current.has(node) ||
            nodeWidth <= 0 ||
            nodeHeight <= 0 ||
            Math.min(x + nodeWidth, left + width) - Math.max(x, left) < nodeWidth * 0.8 ||
            y < top - 2 ||
            y + nodeHeight > top + height + 2
          )
            return;
          const outcome = staleRef.current ? "stale" : "success";
          if (!live.actionable) {
            live.actionable = true;
            recordCatalogPaint("home", "actionable", live.startedAt, outcome);
          }
          if (!live.image && candidates.current.get(node)) {
            live.image = true;
            recordCatalogPaint("home", "image", live.startedAt, outcome);
          }
        });
      }
    });
  }, [viewport]);

  // Coalesce several cards laying out or loading images in the same frame.
  const framePending = useRef(false);
  const inspect = useCallback(() => {
    if (framePending.current || !attempt.current) return;
    framePending.current = true;
    const onFrame = () => {
      framePending.current = false;
      inspectSafely();
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(onFrame);
    else onFrame();
  }, [inspectSafely]);

  useEffect(() => {
    if (!focused) return;
    const current: Attempt = { startedAt: catalogNow(), actionable: false, image: false };
    attempt.current = current;
    inspect();
    return () => {
      if (attempt.current === current) attempt.current = undefined;
      if (!current.actionable) {
        recordCatalogPaint("home", "actionable", current.startedAt, "cancelled");
      }
    };
  }, [focused, inspect, scope]);

  useEffect(() => {
    const current = attempt.current;
    if (!current || current.actionable || !terminal) return;
    current.actionable = true;
    recordCatalogPaint("home", "actionable", current.startedAt, terminal);
  }, [focused, scope, terminal]);

  return useMemo<Observer>(
    () => ({
      inspect,
      observe: (node, image) => {
        candidates.current.set(node, image || candidates.current.get(node) === true);
        inspect();
      },
      remove: (node) => candidates.current.delete(node),
    }),
    [inspect],
  );
}

/** Observe only the first few priced cards of each Home rail. */
export function useCatalogHomeCardVisibility(enabled: boolean) {
  const observer = useContext(CatalogHomeVisibility);
  const node = useRef<View | null>(null);
  const ref = useCallback(
    (element: View | null) => {
      if (node.current) observer?.remove(node.current);
      node.current = element;
    },
    [observer],
  );
  const onLayout = () => {
    if (node.current) observer?.observe(node.current, false);
  };
  const onImageDisplay = () => {
    if (node.current) observer?.observe(node.current, true);
  };
  return enabled && observer ? { ref, onLayout, onImageDisplay } : undefined;
}
