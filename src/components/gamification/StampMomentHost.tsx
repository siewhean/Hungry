import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";

import { StampMoment, type StampMomentContent } from "@/components/gamification/StampMoment";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import {
  ALL_PASSPORT_CATEGORIES,
  PASSPORT_STAMP_DEFINITIONS,
  getEarnedPassportStamps,
} from "@/constants/passportConfig";
import { computeAchievements } from "@/features/achievements/achievements";
import { useAchievementInput } from "@/features/achievements/useAchievementInput";
import { useAchievementsLoopEnabled } from "@/features/passport/useNextStamp";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import {
  trackStampMomentDismissed,
  trackStampMomentOpened,
  trackStampMomentShown,
} from "@/lib/analytics/gamificationEvents";
import { reportError } from "@/lib/monitoring/reportError";
import { useMomentStore, type Moment } from "@/store/useMomentStore";
import { usePassportStore } from "@/store/usePassportStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";

/** Let the screen that caused the stamp finish its own feedback before the celebration lands. */
export const MOMENT_DELAY_MS = 1200;
/** Data that arrives a moment after sign-in must not look like a new achievement. */
export const MOMENT_SETTLE_MS = 3000;
export const MOMENT_AUTO_DISMISS_MS = 8000;

interface StampMomentHostProps {
  onOpenPassport: () => void;
}

/**
 * Celebrates a new stamp or achievement tier right after the action that earned it, on any
 * screen. Mounted once at the root. It also keeps the Passport progress computed for the whole
 * session, which the Home card and the Profile tab ring read.
 */
export function StampMomentHost({ onOpenPassport }: StampMomentHostProps) {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  if (!FEATURE_FLAGS.passportEnabled || !isAuthenticated) return null;
  return <StampMomentGate onOpenPassport={onOpenPassport} />;
}

function StampMomentGate(props: StampMomentHostProps) {
  // Exposure is logged here, once, for signed-in diners who can see the loop.
  const enabled = useAchievementsLoopEnabled({ expose: true });
  if (!enabled) return null;
  return <StampMomentRuntime {...props} />;
}

function usePassportHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => usePassportStore.persist.hasHydrated());
  useEffect(() => {
    if (hydrated) return;
    if (usePassportStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return usePassportStore.persist.onFinishHydration(() => setHydrated(true));
  }, [hydrated]);
  return hydrated;
}

function StampMomentRuntime({ onOpenPassport }: StampMomentHostProps) {
  const reduceMotion = useReduceMotion();
  const userId = useProfileStore((state) => state.profile?.id ?? null);
  // The tried stalls as one stable string, so saves and other edits do not recompute the Passport.
  const triedKey = useStallInteractionStore((state) =>
    Object.values(state.interactions)
      .filter((interaction) => interaction.isTried)
      .map((interaction) => interaction.stallId)
      .sort()
      .join(","),
  );
  const interactionsLoaded = useStallInteractionStore((state) => state.isLoaded);
  const loadInteractions = useStallInteractionStore((state) => state.loadInteractions);
  const computeProgress = usePassportStore((state) => state.computeProgress);
  const progressMap = usePassportStore((state) => state.progressMap);
  const celebratedStampIds = usePassportStore((state) => state.celebratedStampIds);
  const markStampCelebrated = usePassportStore((state) => state.markStampCelebrated);
  const hydrated = usePassportHydrated();
  const queue = useMomentStore((state) => state.queue);
  const enqueue = useMomentStore((state) => state.enqueue);
  const dismissCurrent = useMomentStore((state) => state.dismissCurrent);
  const reportAchievements = useMomentStore((state) => state.reportAchievements);
  const achievementInput = useAchievementInput();
  const [progressReady, setProgressReady] = useState(false);
  const [settled, setSettled] = useState(false);
  const [screenReader, setScreenReader] = useState(false);
  /** Stamps there when the session's data first settled; they stay for the Passport to show. */
  const baseline = useRef<Set<string> | null>(null);

  const current: Moment | undefined = queue[0];
  const [visibleId, setVisibleId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || interactionsLoaded) return;
    // Idempotent: loads the diner's visited stalls once, so the Passport can be computed.
    loadInteractions(userId).catch((error) =>
      reportError(error, { screen: "StampMomentHost", action: "load_interactions" }),
    );
  }, [interactionsLoaded, loadInteractions, userId]);

  useEffect(() => {
    if (!interactionsLoaded || !hydrated) return;
    computeProgress(triedKey ? triedKey.split(",") : []);
    setProgressReady(true);
  }, [computeProgress, hydrated, interactionsLoaded, triedKey]);

  useEffect(() => {
    if (!interactionsLoaded) return;
    const timer = setTimeout(() => setSettled(true), MOMENT_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [interactionsLoaded]);

  useEffect(() => {
    void AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader);
    const subscription = AccessibilityInfo.addEventListener("screenReaderChanged", setScreenReader);
    return () => subscription.remove();
  }, []);

  // New stamps: anything earned that was not there when the data settled and was not celebrated.
  useEffect(() => {
    if (!progressReady || !hydrated) return;
    const earned = getEarnedPassportStamps(progressMap);
    if (baseline.current === null) {
      baseline.current = new Set(earned.map((stamp) => stamp.id));
      return;
    }
    for (const stamp of earned) {
      if (baseline.current.has(stamp.id) || celebratedStampIds[stamp.id]) continue;
      baseline.current.add(stamp.id);
      markStampCelebrated(stamp.id);
      enqueue({ kind: "stamp", id: stamp.id, stampId: stamp.id });
    }
  }, [celebratedStampIds, enqueue, hydrated, markStampCelebrated, progressReady, progressMap]);

  // New achievement tiers.
  const achievementRows = useMemo(() => computeAchievements(achievementInput), [achievementInput]);
  useEffect(() => {
    if (!settled || !userId) return;
    reportAchievements(userId, achievementRows);
  }, [achievementRows, reportAchievements, settled, userId]);

  // Show the head of the queue after a short pause.
  useEffect(() => {
    if (!current) {
      setVisibleId(null);
      return;
    }
    if (visibleId === current.id) return;
    const timer = setTimeout(() => setVisibleId(current.id), MOMENT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [current, visibleId]);

  const shown = current && visibleId === current.id ? current : null;
  const content = useMemo<StampMomentContent | null>(() => {
    if (!shown) return null;
    if (shown.kind === "achievement") return { kind: "achievement", unlock: shown.unlock };
    const stamp = PASSPORT_STAMP_DEFINITIONS.find((item) => item.id === shown.stampId);
    const category = stamp
      ? ALL_PASSPORT_CATEGORIES.find((item) => item.id === stamp.categoryId)
      : undefined;
    if (!stamp || !category) return null;
    return {
      kind: "stamp",
      stamp,
      category,
      triedCount: progressMap[category.id]?.triedCount ?? stamp.threshold,
    };
  }, [progressMap, shown]);

  const shownId = shown?.id;
  const shownKind = shown?.kind;
  const hasContent = content !== null;
  useEffect(() => {
    if (!shownId || !shownKind || !hasContent) return;
    trackStampMomentShown({ kind: shownKind, momentId: shownId });
    const timer = screenReader
      ? null
      : setTimeout(() => {
          trackStampMomentDismissed({ kind: shownKind, momentId: shownId, how: "timeout" });
          dismissCurrent();
        }, MOMENT_AUTO_DISMISS_MS);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [dismissCurrent, hasContent, screenReader, shownId, shownKind]);

  // A moment whose stamp is not in the config would block the queue forever: drop it.
  useEffect(() => {
    if (shown && !content) dismissCurrent();
  }, [content, dismissCurrent, shown]);

  if (!shown || !content) return null;

  return (
    <StampMoment
      key={shown.id}
      content={content}
      reduceMotion={reduceMotion}
      onOpenPassport={() => {
        trackStampMomentOpened({ kind: shown.kind, momentId: shown.id });
        dismissCurrent();
        onOpenPassport();
      }}
      onDismiss={() => {
        trackStampMomentDismissed({ kind: shown.kind, momentId: shown.id, how: "button" });
        dismissCurrent();
      }}
    />
  );
}
