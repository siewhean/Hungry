/**
 * Opening hours a diner suggests for a stall that has none: every day, weekdays and weekends,
 * or day by day (with special dates). Pure, so the screen only collects and sends. The hours
 * travel as a catalog correction note for the team to check, never straight onto the stall.
 */
import type { OpeningSchedule, OpeningTimeRange } from "@/types/domain";
import {
  OPENING_DAY_KEYS,
  formatScheduleText,
  hasWeeklyHours,
  validateOpeningSchedule,
} from "@/utils/openingSchedule";

export type SuggestedHoursMode = "daily" | "weekdayWeekend" | "custom";

export type SuggestedHoursDraft = {
  mode: SuggestedHoursMode;
  /** Every day. */
  daily: OpeningTimeRange[];
  /** Monday to Friday. */
  weekday: OpeningTimeRange[];
  /** Saturday and Sunday; empty means closed. */
  weekend: OpeningTimeRange[];
  /** Day by day, with special dates. */
  custom: OpeningSchedule;
};

/** submit_catalog_correction keeps a note to this many characters. */
export const SUGGESTED_HOURS_NOTE_MAX = 500;
const NOTE_PREFIX = "Opening hours: ";

export const DEFAULT_SUGGESTED_RANGE: OpeningTimeRange = { open: "09:00", close: "21:00" };

export function emptySuggestedHoursDraft(): SuggestedHoursDraft {
  return {
    mode: "daily",
    daily: [DEFAULT_SUGGESTED_RANGE],
    weekday: [DEFAULT_SUGGESTED_RANGE],
    weekend: [DEFAULT_SUGGESTED_RANGE],
    custom: { weekly: {}, special: [] },
  };
}

const copy = (ranges: OpeningTimeRange[]) => ranges.map((range) => ({ ...range }));

/** The weekly schedule the chosen mode describes. */
export function buildSuggestedSchedule(draft: SuggestedHoursDraft): OpeningSchedule {
  if (draft.mode === "custom") return draft.custom;
  const weekly: OpeningSchedule["weekly"] = {};
  OPENING_DAY_KEYS.forEach((key, index) => {
    const ranges = draft.mode === "daily" ? draft.daily : index < 5 ? draft.weekday : draft.weekend;
    weekly[key] = copy(ranges);
  });
  return { weekly, special: [] };
}

/** The note sent with the report: weekly hours, then any special dates. */
export function describeSuggestedHours(schedule: OpeningSchedule): string {
  const parts: string[] = [];
  const weekly = formatScheduleText(schedule);
  if (weekly) parts.push(weekly);
  for (const day of schedule.special ?? []) {
    const ranges = day.ranges.map((range) => `${range.open}-${range.close}`).join(", ");
    parts.push(`${day.date} ${ranges || "Closed"}`);
  }
  return `${NOTE_PREFIX}${parts.join("; ")}`;
}

/** What stops the diner sending these hours, worded for them, or undefined when they can send. */
export function suggestedHoursProblem(draft: SuggestedHoursDraft): string | undefined {
  const schedule = buildSuggestedSchedule(draft);
  const invalid = validateOpeningSchedule(schedule);
  if (invalid) return invalid;
  if (draft.mode === "daily" && draft.daily.length === 0) return "Add the opening times.";
  if (draft.mode === "weekdayWeekend" && draft.weekday.length === 0) {
    return "Add the weekday opening times.";
  }
  const specialCount = (schedule.special ?? []).length;
  const hasWeekly = hasWeeklyHours(schedule);
  if (draft.mode === "custom" && !hasWeekly && specialCount === 0) {
    return "Switch on the days the stall is open and set their times.";
  }
  if (describeSuggestedHours(schedule).length > SUGGESTED_HOURS_NOTE_MAX) {
    return "That is too much to send. Remove a few special days.";
  }
  return undefined;
}
