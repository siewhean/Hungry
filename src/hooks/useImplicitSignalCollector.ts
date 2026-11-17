/**
 * Implicit Signal Collector Hook
 *
 * Tracks behavioral signals (dwell time, scroll patterns, gallery interaction)
 * that implicitly reveal user taste preferences. Signals are batched and
 * flushed to the AI feedback processor on a configurable interval.
 *
 * Usage:
 *   const { trackDishView, trackDishDismiss, flush } = useImplicitSignalCollector();
 *
 * Signals collected:
 *   - dwell_time: user lingers on a dish detail screen > threshold
 *   - photo_zoom: user browses gallery or zooms into dish photo
 *   - category_click: user taps a taste/category filter chip
 *   - ignored_recommendation: user dismisses a "Decide for Me" result
 *   - rapid_scroll_past: user scrolls past a recommended dish quickly
 */

import { useCallback, useEffect, useRef } from "react";

import { useProfileStore } from "@/store/useProfileStore";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { ImplicitSignalInput } from "@/lib/services/types";

// ─── Configuration ────────────────────────────────────────────────────────────

/** Minimum dwell time (ms) before a dish view counts as a positive signal */
const DWELL_THRESHOLD_MS = 15_000;

/** How often (ms) to flush batched signals to the AI processor */
const FLUSH_INTERVAL_MS = 60_000;

/** Maximum signals to batch before auto-flushing */
const MAX_BATCH_SIZE = 20;

/** Phase 3 keeps learning explicit-only; implicit signals are collected later. */
const IMPLICIT_LEARNING_ENABLED = false;

// ─── Signal Buffer ────────────────────────────────────────────────────────────

let signalBuffer: ImplicitSignalInput[] = [];

function addSignal(signal: ImplicitSignalInput) {
  signalBuffer.push(signal);
  if (signalBuffer.length >= MAX_BATCH_SIZE) {
    flushSignals();
  }
}

async function flushSignals() {
  if (signalBuffer.length === 0) return;

  const batch = [...signalBuffer];
  signalBuffer = [];

  if (!IMPLICIT_LEARNING_ENABLED) {
    return;
  }

  try {
    const service = getHungryService();
    const updatedVector = await service.ai.processImplicitFeedback(batch);

    // Persist the updated taste vector back to the profile store
    const { setTasteVector } = useProfileStore.getState();
    setTasteVector(updatedVector);
  } catch {
    // On failure, re-queue the signals for the next flush
    signalBuffer = [...batch, ...signalBuffer];
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook that provides methods to collect implicit behavioral signals.
 * Automatically flushes buffered signals on a timer and on unmount.
 */
export function useImplicitSignalCollector() {
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Set up periodic flush
  useEffect(() => {
    flushTimerRef.current = setInterval(flushSignals, FLUSH_INTERVAL_MS);
    return () => {
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      // Flush remaining signals on unmount
      flushSignals();
    };
  }, []);

  /**
   * Track when a user opens a dish detail screen.
   * Returns a cleanup function that records dwell_time if threshold is met.
   */
  const trackDishView = useCallback((dishId: string) => {
    const startTime = Date.now();

    return () => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= DWELL_THRESHOLD_MS) {
        addSignal({
          type: "dwell_time",
          dishId,
          timestamp: startTime,
        });
      }
    };
  }, []);

  /**
   * Track when a user zooms or browses gallery photos on a dish.
   */
  const trackPhotoZoom = useCallback((dishId: string) => {
    addSignal({
      type: "photo_zoom",
      dishId,
      timestamp: Date.now(),
    });
  }, []);

  /**
   * Track when a user taps a category/taste filter chip.
   */
  const trackCategoryClick = useCallback((dishId: string) => {
    addSignal({
      type: "category_click",
      dishId,
      timestamp: Date.now(),
    });
  }, []);

  /**
   * Track when a user ignores/dismisses a recommendation.
   */
  const trackDishDismiss = useCallback((dishId: string) => {
    addSignal({
      type: "ignored_recommendation",
      dishId,
      timestamp: Date.now(),
    });
  }, []);

  /**
   * Track when a user rapidly scrolls past a dish card (< 500ms visibility).
   */
  const trackRapidScrollPast = useCallback((dishId: string) => {
    addSignal({
      type: "rapid_scroll_past",
      dishId,
      timestamp: Date.now(),
    });
  }, []);

  /**
   * Manually flush all buffered signals (e.g., on app background).
   */
  const flush = useCallback(() => {
    flushSignals();
  }, []);

  return {
    trackDishView,
    trackPhotoZoom,
    trackCategoryClick,
    trackDishDismiss,
    trackRapidScrollPast,
    flush,
  };
}
