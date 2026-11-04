import { useMemo } from "react";

import { summariseNextStamp, type NextStampSummary } from "@/features/passport/nextStamp";
import { useWeeklyGoal } from "@/features/passport/useWeeklyGoal";
import { getNextPassportStamp } from "@/constants/passportConfig";
import { useExperimentVariant } from "@/lib/experiments/experiments";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { usePassportStore } from "@/store/usePassportStore";

/** True while the achievements loop is on (Passport on, and no PostHog kill switch). */
export function useAchievementsLoopEnabled(options: { expose?: boolean } = {}): boolean {
  const variant = useExperimentVariant("achievements_loop_v1", {
    enabled: FEATURE_FLAGS.passportEnabled,
    expose: options.expose ?? false,
  });
  return FEATURE_FLAGS.passportEnabled && variant === "loop";
}

/** The closest stamp or open weekly goal, read from the Passport progress the host keeps fresh. */
export function useNextStamp(): NextStampSummary | null {
  const progressMap = usePassportStore((state) => state.progressMap);
  const isComputed = usePassportStore((state) => state.isComputed);
  const goal = useWeeklyGoal();
  return useMemo(
    () => (isComputed ? summariseNextStamp(getNextPassportStamp(progressMap), goal) : null),
    [goal, isComputed, progressMap],
  );
}
