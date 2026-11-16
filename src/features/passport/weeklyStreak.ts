// Weekly streak: one new dish or stall in a Singapore week (Monday to Sunday) keeps the week.
// It is weekly, not daily, so it fits how often people eat out somewhere new, and it forgives:
// every four weeks kept in a row earn a rest week (up to two saved), and a missed week uses one
// instead of ending the streak. The week in progress never breaks it: until Sunday ends it is
// "not kept yet", and the streak shows the weeks before it.
// It awards no Food Cred, so nothing here needs server validation.

const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

export const STREAK_MILESTONES = [2, 4, 8, 12, 26, 52] as const;
/** Weeks kept in a row that earn one rest week. */
export const WEEKS_PER_REST_WEEK = 4;
export const MAX_REST_WEEKS = 2;

export interface WeeklyStreak {
  /** Weeks in the current streak, this week included once it is kept. */
  weeks: number;
  keptThisWeek: boolean;
  /** Rest weeks saved for a missed week. */
  restWeeks: number;
  /** True when last week was missed and a rest week covered it. */
  restWeekUsedLastWeek: boolean;
  longest: number;
  /** The next milestone in weeks, or null past the last one. */
  nextMilestone: number | null;
  /** The milestone this week's keep reached, if it reached one. */
  milestoneReached: number | null;
}

/** Index of the Singapore week (weeks start Monday 00:00 SGT) that holds `time`. */
export function singaporeWeekIndex(time: number): number {
  const local = time + SINGAPORE_OFFSET_MS;
  // 1970-01-01 was a Thursday; shift so weeks start on Monday.
  return Math.floor((local + 3 * DAY_MS) / WEEK_MS);
}

/** `triedAt` timestamps of tried stalls and tried dishes, one per item. */
export function computeWeeklyStreak(triedAt: readonly string[], now = new Date()): WeeklyStreak {
  const nowTime = now.getTime();
  const currentWeek = singaporeWeekIndex(nowTime);
  const keptWeeks = new Set<number>();
  for (const value of triedAt) {
    const time = Date.parse(value);
    if (Number.isNaN(time) || time > nowTime) continue;
    keptWeeks.add(singaporeWeekIndex(time));
  }
  const keptThisWeek = keptWeeks.has(currentWeek);
  const empty: WeeklyStreak = {
    weeks: 0,
    keptThisWeek,
    restWeeks: 0,
    restWeekUsedLastWeek: false,
    longest: 0,
    nextMilestone: STREAK_MILESTONES[0],
    milestoneReached: null,
  };
  if (keptWeeks.size === 0) return empty;

  let weeks = 0;
  let longest = 0;
  let restWeeks = 0;
  let keptInRow = 0;
  let restWeekUsedLastWeek = false;
  const firstWeek = Math.min(...keptWeeks);
  // The week in progress only counts once kept; a not-yet-kept week is not a miss.
  const lastWeek = keptThisWeek ? currentWeek : currentWeek - 1;
  for (let week = firstWeek; week <= lastWeek; week += 1) {
    if (keptWeeks.has(week)) {
      weeks += 1;
      keptInRow += 1;
      if (keptInRow % WEEKS_PER_REST_WEEK === 0)
        restWeeks = Math.min(MAX_REST_WEEKS, restWeeks + 1);
      restWeekUsedLastWeek = false;
    } else if (restWeeks > 0 && weeks > 0) {
      // A rest week holds the streak but adds no week to it.
      restWeeks -= 1;
      keptInRow = 0;
      restWeekUsedLastWeek = week === currentWeek - 1;
    } else {
      weeks = 0;
      keptInRow = 0;
      restWeekUsedLastWeek = false;
    }
    longest = Math.max(longest, weeks);
  }

  return {
    weeks,
    keptThisWeek,
    restWeeks,
    restWeekUsedLastWeek,
    longest,
    nextMilestone: STREAK_MILESTONES.find((m) => m > weeks) ?? null,
    milestoneReached:
      keptThisWeek && (STREAK_MILESTONES as readonly number[]).includes(weeks) ? weeks : null,
  };
}

/** One short line for the streak, or null when there is none to show yet. */
export function streakLabel(streak: WeeklyStreak): string | null {
  if (streak.weeks === 0) return null;
  const weeks = `${streak.weeks}-week streak`;
  if (!streak.keptThisWeek) return `${weeks}. Try one new place this week to keep it`;
  return weeks;
}
