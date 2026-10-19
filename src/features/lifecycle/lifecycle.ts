// Lifecycle states, after Duolingo's growth model, adapted to food use:
// "current" means active within the past week, not yesterday. The server
// definition is lifecycle_state_for() in
// supabase/migrations/20261019200000_user_lifecycle_states.sql; this mirror
// serves the mock service and the tests.

import type { LifecycleSnapshot, LifecycleState } from "@/types/domain";

const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

/** Today's date in Singapore as YYYY-MM-DD. */
export function singaporeDateKey(now = new Date()): string {
  return new Date(now.getTime() + SINGAPORE_OFFSET_MS).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** State on `today` given the Singapore dates the user was active; null if never active. */
export function classifyLifecycle(activeDates: string[], today: string): LifecycleState | null {
  const activeToday = activeDates.includes(today);
  const previous = activeDates
    .filter((date) => date < today)
    .sort()
    .at(-1);

  if (activeToday) {
    if (!previous) return "new";
    const gap = daysBetween(previous, today);
    if (gap <= 7) return "current";
    return gap <= 30 ? "reactivated" : "resurrected";
  }
  if (!previous) return null;
  const gap = daysBetween(previous, today);
  if (gap <= 7) return "at_risk_weekly";
  return gap <= 30 ? "at_risk_monthly" : "dormant";
}

/** Builds what record_app_open() returns, after today's visit is recorded. */
export function buildLifecycleSnapshot(activeDates: string[], today: string): LifecycleSnapshot {
  const dates = activeDates.includes(today) ? activeDates : [...activeDates, today];
  const previous =
    dates
      .filter((date) => date < today)
      .sort()
      .at(-1) ?? null;
  return {
    state: classifyLifecycle(dates, today) ?? "new",
    previousActiveDate: previous,
    daysSincePrevious: previous ? daysBetween(previous, today) : null,
  };
}

/** Back after more than a week away: the moment for a welcome back. */
export function isReturningAfterBreak(state: LifecycleState | undefined | null): boolean {
  return state === "reactivated" || state === "resurrected";
}
