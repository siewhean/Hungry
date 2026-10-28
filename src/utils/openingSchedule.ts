/**
 * Structured opening hours: a fixed weekly schedule plus special hours by date, read in
 * Singapore time. Merchants edit this; the free-text operating_hours line is derived from it
 * (formatScheduleText) so older readers and the catalog keep a readable line.
 */
import type { OpeningDayKey, OpeningSchedule, OpeningTimeRange } from "@/types/domain";
import {
  DAY_ORDER,
  formatClockMinutes,
  formatNextOpening,
  getHoursForDay,
  parseOperatingHours,
  type DayName,
  type OpenState,
} from "./operatingHours";

export const OPENING_DAY_KEYS: OpeningDayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const MAX_RANGES_PER_DAY = 3;
export const MAX_SPECIAL_DAYS = 60;

const CLOCK_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const DAY_MINUTES = 24 * 60;

function toDayName(key: OpeningDayKey): DayName {
  return DAY_ORDER[OPENING_DAY_KEYS.indexOf(key)];
}

/** "10:00" -> 600. "24:00" is allowed as a closing time. */
export function parseClock(value: string, allowEndOfDay = false): number | null {
  if (allowEndOfDay && value === "24:00") return DAY_MINUTES;
  const match = CLOCK_PATTERN.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function toClock(minutes: number): string {
  if (minutes >= DAY_MINUTES) return "24:00";
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function toMinuteRange(range: OpeningTimeRange): [number, number] | null {
  const open = parseClock(range.open);
  const close = parseClock(range.close, true);
  return open === null || close === null ? null : [open, close];
}

/** A problem with the schedule, worded for the merchant, or undefined when it is valid. */
export function validateOpeningSchedule(schedule: OpeningSchedule): string | undefined {
  for (const key of OPENING_DAY_KEYS) {
    const ranges = schedule.weekly[key] ?? [];
    if (ranges.length > MAX_RANGES_PER_DAY) {
      return `${toDayName(key)} can have at most ${MAX_RANGES_PER_DAY} time ranges.`;
    }
    for (const range of ranges) {
      if (!toMinuteRange(range)) return `${toDayName(key)}: use 24-hour times like 09:30.`;
    }
  }
  const special = schedule.special ?? [];
  if (special.length > MAX_SPECIAL_DAYS) {
    return `Add at most ${MAX_SPECIAL_DAYS} special days.`;
  }
  const seen = new Set<string>();
  for (const day of special) {
    if (!DATE_PATTERN.test(day.date)) return "Special days need a date like 2026-12-25.";
    if (seen.has(day.date)) return `${day.date} is listed twice.`;
    seen.add(day.date);
    if (day.ranges.length > MAX_RANGES_PER_DAY) {
      return `${day.date} can have at most ${MAX_RANGES_PER_DAY} time ranges.`;
    }
    for (const range of day.ranges) {
      if (!toMinuteRange(range)) return `${day.date}: use 24-hour times like 09:30.`;
    }
  }
  return undefined;
}

export function hasWeeklyHours(schedule?: OpeningSchedule | null): schedule is OpeningSchedule {
  return Boolean(schedule && OPENING_DAY_KEYS.some((key) => (schedule.weekly[key] ?? []).length));
}

function getSingaporeClock(now: Date) {
  // Singapore is UTC+8 all year (no daylight saving).
  const sgt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const dayIndex = (sgt.getUTCDay() + 6) % 7;
  return {
    dateKey: sgt.toISOString().slice(0, 10),
    dayIndex,
    minutes: sgt.getUTCHours() * 60 + sgt.getUTCMinutes(),
  };
}

function shiftDate(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The ranges for one date: a special day wins over the weekly schedule. */
export function getScheduleRangesForDate(
  schedule: OpeningSchedule,
  dateKey: string,
  dayIndex: number,
): { ranges: [number, number][]; special: boolean } {
  const special = schedule.special?.find((day) => day.date === dateKey);
  const source = special ? special.ranges : (schedule.weekly[OPENING_DAY_KEYS[dayIndex]] ?? []);
  return {
    ranges: source.map(toMinuteRange).filter((range): range is [number, number] => !!range),
    special: Boolean(special),
  };
}

const runsPastMidnight = ([open, close]: [number, number]) => close < open;

/** The first opening in the seven days after `dateKey` (specials win); undefined when none. */
function findNextScheduledOpening(
  schedule: OpeningSchedule,
  dateKey: string,
  dayIndex: number,
): string | undefined {
  for (let offset = 1; offset <= 7; offset += 1) {
    const nextIndex = (dayIndex + offset) % 7;
    const { ranges } = getScheduleRangesForDate(schedule, shiftDate(dateKey, offset), nextIndex);
    const first = [...ranges].sort((left, right) => left[0] - right[0])[0];
    if (first) return formatNextOpening(first[0], offset, DAY_ORDER[nextIndex]);
  }
  return undefined;
}

/** "Closed today" with its reason and, when known, when the stall opens next. */
function closedTodayDetail(special: boolean, nextOpening: string | undefined): string {
  const base = special ? "Closed today (special hours)" : "Closed today";
  return nextOpening ? (special ? `${base} · ${nextOpening}` : nextOpening) : base;
}

/**
 * Open or closed right now in Singapore from the structured schedule. `isOpen` is the stored
 * venue flag: false (a closure notice) always means closed.
 */
export function getScheduleOpenState(
  schedule: OpeningSchedule,
  isOpen: boolean,
  now: Date = new Date(),
): OpenState {
  if (!isOpen) return { status: "closed" };
  const { dateKey, dayIndex, minutes } = getSingaporeClock(now);

  const yesterday = getScheduleRangesForDate(schedule, shiftDate(dateKey, -1), (dayIndex + 6) % 7);
  const overnight = yesterday.ranges.find((range) => runsPastMidnight(range) && minutes < range[1]);
  if (overnight) return { status: "open", detail: `Closes ${formatClockMinutes(overnight[1])}` };

  const today = getScheduleRangesForDate(schedule, dateKey, dayIndex);
  const prefix = today.special ? "Special hours · " : "";
  if (today.ranges.length === 0) {
    return {
      status: "closed",
      detail: closedTodayDetail(
        today.special,
        findNextScheduledOpening(schedule, dateKey, dayIndex),
      ),
    };
  }
  const current = today.ranges.find(([open, close]) => {
    if (open === close) return true;
    if (runsPastMidnight([open, close])) return minutes >= open;
    return minutes >= open && minutes < close;
  });
  if (current) {
    return current[0] === current[1] || (current[0] === 0 && current[1] === DAY_MINUTES)
      ? { status: "open", detail: `${prefix}Open 24 hours` }
      : { status: "open", detail: `${prefix}Closes ${formatClockMinutes(current[1])}` };
  }
  const next = today.ranges
    .filter(([open]) => open > minutes)
    .sort((left, right) => left[0] - right[0])[0];
  return next
    ? { status: "closed", detail: `${prefix}Opens ${formatClockMinutes(next[0])}` }
    : {
        status: "closed",
        detail: findNextScheduledOpening(schedule, dateKey, dayIndex) ?? "Closed for today",
      };
}

function formatRanges(ranges: OpeningTimeRange[]): string {
  if (ranges.length === 0) return "Closed";
  return ranges
    .map((range) => {
      const minutes = toMinuteRange(range);
      if (!minutes) return "";
      if (minutes[0] === 0 && minutes[1] === DAY_MINUTES) return "24 hours";
      return `${formatClockMinutes(minutes[0])}-${formatClockMinutes(minutes[1])}`;
    })
    .filter(Boolean)
    .join(", ");
}

/** Consecutive days with the same hours, e.g. [{ label: "Mon-Fri", text: "10am-8pm" }]. */
export function formatScheduleRows(schedule: OpeningSchedule): { label: string; text: string }[] {
  const rows: { start: number; end: number; text: string }[] = [];
  OPENING_DAY_KEYS.forEach((key, index) => {
    const text = formatRanges(schedule.weekly[key] ?? []);
    const previous = rows[rows.length - 1];
    if (previous && previous.text === text && previous.end === index - 1) previous.end = index;
    else rows.push({ start: index, end: index, text });
  });
  return rows.map(({ start, end, text }) => ({
    label:
      start === 0 && end === 6
        ? "Daily"
        : start === end
          ? DAY_ORDER[start]
          : `${DAY_ORDER[start]}-${DAY_ORDER[end]}`,
    text,
  }));
}

/** Today's hours in Singapore from the schedule (a special day wins), e.g. "10am-8pm" or "Closed". */
export function formatScheduleToday(schedule: OpeningSchedule, now: Date = new Date()): string {
  const { dateKey, dayIndex } = getSingaporeClock(now);
  const special = schedule.special?.find((day) => day.date === dateKey);
  return formatRanges(
    special ? special.ranges : (schedule.weekly[OPENING_DAY_KEYS[dayIndex]] ?? []),
  );
}

/** The free-text line saved alongside the schedule; parseOperatingHours reads it back. */
export function formatScheduleText(schedule: OpeningSchedule): string {
  if (!hasWeeklyHours(schedule)) return "";
  return formatScheduleRows(schedule)
    .map((row) => `${row.label} ${row.text}`)
    .join("; ");
}

/** Best-effort weekly schedule from older free-text hours, to seed the editor. */
export function scheduleFromHoursText(text: string | undefined): OpeningSchedule {
  const rows = parseOperatingHours(text);
  const weekly: OpeningSchedule["weekly"] = {};
  OPENING_DAY_KEYS.forEach((key) => {
    const row = getHoursForDay(rows, toDayName(key));
    weekly[key] =
      !row || row.closed
        ? []
        : row.ranges
            .slice(0, MAX_RANGES_PER_DAY)
            .map(([open, close]) => ({ open: toClock(open % DAY_MINUTES), close: toClock(close) }));
  });
  return { weekly, special: [] };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Special hours from today (Singapore) for the next `days` days, e.g. "Thu 25 Dec: Closed". */
export function getUpcomingSpecialHours(
  schedule: OpeningSchedule,
  now: Date = new Date(),
  days = 14,
): { label: string; text: string }[] {
  const today = getSingaporeClock(now).dateKey;
  const last = shiftDate(today, days - 1);
  return (schedule.special ?? [])
    .filter((day) => day.date >= today && day.date <= last)
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((day) => {
      const date = new Date(`${day.date}T00:00:00Z`);
      const weekday = DAY_ORDER[(date.getUTCDay() + 6) % 7];
      return {
        label: `${weekday} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`,
        text: formatRanges(day.ranges),
      };
    });
}
