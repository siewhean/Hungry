import { useEffect, useMemo, useRef, useState } from "react";

type MovingSearchPlaceholderOptions = {
  phrases?: unknown;
  enabled?: boolean;
  totalCycleMs?: number;
  tickMs?: number;
  pauseMs?: number;
  revealStepMs?: number;
  deleteStepMs?: number;
};

type PlaceholderAnimationPhase = "revealing" | "holding" | "slidingLeft" | "gap";

const DEFAULT_PLACEHOLDER = "Search...";
const MIN_CYCLE_MS = 6_000;
const MIN_PAUSE_MS = 1_200;
const MIN_REVEAL_STEP_MS = 88;
const MIN_SLIDE_STEP_MS = 32;
const MIN_GAP_MS = 260;

function normalizePhrases(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [DEFAULT_PLACEHOLDER];
  }

  const phrases = input
    .map((value) => (typeof value === "string" ? value : ""))
    .map((phrase) => phrase.trim())
    .filter((phrase): phrase is string => phrase.length > 0);

  return phrases.length > 0 ? phrases : [DEFAULT_PLACEHOLDER];
}

function getInitialAnimatedPlaceholder(phrases: readonly string[]) {
  return (phrases[0] ?? DEFAULT_PLACEHOLDER).slice(0, 1);
}

export function useMovingSearchPlaceholder({
  phrases,
  enabled = true,
  totalCycleMs = 10_000,
  tickMs = MIN_REVEAL_STEP_MS,
  pauseMs = MIN_PAUSE_MS,
  revealStepMs = MIN_REVEAL_STEP_MS,
  deleteStepMs = MIN_SLIDE_STEP_MS,
}: MovingSearchPlaceholderOptions) {
  const normalizedPhrases = useMemo(() => normalizePhrases(phrases), [phrases]);

  const [animatedPlaceholder, setAnimatedPlaceholder] = useState(() =>
    getInitialAnimatedPlaceholder(normalizedPhrases),
  );
  const phraseIndexRef = useRef(0);
  const animationPhaseRef = useRef<PlaceholderAnimationPhase>("revealing");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTextRef = useRef<string>(getInitialAnimatedPlaceholder(normalizedPhrases));

  useEffect(() => {
    if (!enabled || normalizedPhrases.length === 0) {
      const fallback = normalizedPhrases[0] ?? DEFAULT_PLACEHOLDER;
      lastTextRef.current = fallback;
      setAnimatedPlaceholder(fallback);
      phraseIndexRef.current = 0;
      animationPhaseRef.current = "revealing";
      return undefined;
    }

    const revealDelayMs = Math.max(MIN_REVEAL_STEP_MS, revealStepMs, tickMs);
    const slideDelayMs = Math.max(MIN_SLIDE_STEP_MS, deleteStepMs);
    const clampedPauseMs = Math.max(MIN_PAUSE_MS, pauseMs);
    const cycleMs = Math.max(MIN_CYCLE_MS, totalCycleMs);
    const gapMs = MIN_GAP_MS;

    const currentPhrase = () =>
      normalizedPhrases[phraseIndexRef.current % normalizedPhrases.length] ?? DEFAULT_PLACEHOLDER;

    const setVisibleText = (nextText: string) => {
      if (nextText !== lastTextRef.current) {
        lastTextRef.current = nextText;
        setAnimatedPlaceholder(nextText);
      }
    };

    const holdDelayForPhrase = (phrase: string) => {
      const revealDurationMs = phrase.length * revealDelayMs;
      const slideDurationMs = phrase.length * slideDelayMs;
      const remainingCycleMs = cycleMs - revealDurationMs - slideDurationMs - gapMs;
      return Math.max(clampedPauseMs, remainingCycleMs);
    };

    const scheduleNextStep = (delayMs: number) => {
      timeoutRef.current = setTimeout(step, delayMs);
    };

    function step() {
      const phrase = currentPhrase();
      const visibleText = lastTextRef.current;

      if (animationPhaseRef.current === "revealing") {
        const nextVisibleCount = Math.min(phrase.length, visibleText.length + 1);
        setVisibleText(phrase.slice(0, nextVisibleCount));
        if (nextVisibleCount >= phrase.length) {
          animationPhaseRef.current = "holding";
          scheduleNextStep(holdDelayForPhrase(phrase));
          return;
        }
        scheduleNextStep(revealDelayMs);
        return;
      }

      if (animationPhaseRef.current === "holding") {
        animationPhaseRef.current = "slidingLeft";
        scheduleNextStep(slideDelayMs);
        return;
      }

      if (animationPhaseRef.current === "slidingLeft") {
        const nextVisibleText = visibleText.slice(1);
        setVisibleText(nextVisibleText);
        if (nextVisibleText.length === 0) {
          animationPhaseRef.current = "gap";
          scheduleNextStep(gapMs);
          return;
        }
        scheduleNextStep(slideDelayMs);
        return;
      }

      phraseIndexRef.current = (phraseIndexRef.current + 1) % normalizedPhrases.length;
      animationPhaseRef.current = "revealing";
      setVisibleText(currentPhrase().slice(0, 1));
      scheduleNextStep(revealDelayMs);
    }

    phraseIndexRef.current = 0;
    animationPhaseRef.current = "revealing";
    setVisibleText(currentPhrase().slice(0, 1));
    scheduleNextStep(revealDelayMs);

    return () => {
      if (timeoutRef.current != null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [enabled, normalizedPhrases, pauseMs, tickMs, totalCycleMs, revealStepMs, deleteStepMs]);

  return animatedPlaceholder;
}
