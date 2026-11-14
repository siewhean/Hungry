// Sunday recap: a short look back at the week, on Home on Sunday and until Monday noon (SGT).
// Shown only when the diner tried somewhere new that week, so it is never a nag; it says what
// they did and how their streak stands, then gets out of the way once dismissed.

import {
  STREAK_MILESTONES,
  computeWeeklyStreak,
  singaporeWeekIndex,
  type WeeklyStreak,
} from "@/features/passport/weeklyStreak";

const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
/** On Monday the recap of last week stays until this hour (SGT). */
const MONDAY_UNTIL_HOUR = 12;

export interface WeeklyRecap {
  /** singaporeWeekIndex of the week recapped: the key a dismissal is saved under. */
  week: number;
  places: number;
  streak: WeeklyStreak;
  title: string;
  body: string;
}

/** The week to recap at `now`, or null outside Sunday and Monday morning (SGT). */
export function recapWeekAt(now: Date): number | null {
  const local = new Date(now.getTime() + SINGAPORE_OFFSET_MS);
  const day = local.getUTCDay();
  const week = singaporeWeekIndex(now.getTime());
  if (day === 0) return week;
  if (day === 1 && local.getUTCHours() < MONDAY_UNTIL_HOUR) return week - 1;
  return null;
}

/** The last moment of a Singapore week, as a Date. */
function endOfWeek(week: number): Date {
  // Inverse of singaporeWeekIndex: week start (Monday 00:00 SGT) in UTC.
  const start = week * WEEK_MS - 3 * DAY_MS - SINGAPORE_OFFSET_MS;
  return new Date(start + WEEK_MS - 1);
}

export function buildWeeklyRecap(triedAt: readonly string[], now = new Date()): WeeklyRecap | null {
  const week = recapWeekAt(now);
  if (week === null) return null;
  const places = triedAt.filter((value) => {
    const time = Date.parse(value);
    return !Number.isNaN(time) && time <= now.getTime() && singaporeWeekIndex(time) === week;
  }).length;
  if (places === 0) return null;
  const at = new Date(Math.min(now.getTime(), endOfWeek(week).getTime()));
  const streak = computeWeeklyStreak(triedAt, at);
  const placesLine = `You tried ${places} new ${places === 1 ? "place" : "places"} this week.`;
  const streakLine =
    streak.weeks >= 2
      ? (STREAK_MILESTONES as readonly number[]).includes(streak.weeks)
        ? ` That is a ${streak.weeks}-week streak, a new milestone.`
        : ` Your streak is ${streak.weeks} weeks.`
      : " One new place next week starts a streak.";
  return {
    week,
    places,
    streak,
    title: "Your week in food",
    body: `${placesLine}${streakLine}`,
  };
}
