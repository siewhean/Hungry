/**
 * One structured parser for listed opening hours, read in Singapore time.
 * Stall detail, dish detail and the open/closed helpers all share it so the
 * same text never reads as "Open now" on one page and "Closed" on another.
 */

export const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type DayName = (typeof DAY_ORDER)[number];

/** Minutes after midnight: [open, close]. close < open means the range runs past midnight. */
export type MinuteRange = [startMinutes: number, endMinutes: number];

export type HoursRow = {
  /** The days this row covers, or null when the text named no days. */
  days: DayName[] | null;
  closed: boolean;
  ranges: MinuteRange[];
  /** The listed time text for this row, e.g. "10am-8pm". */
  text: string;
};

export type OpenState = {
  status: "open" | "closed" | "unknown";
  /** "Closes 9pm", "Opens 5pm", "Closed today", or undefined. */
  detail?: string;
};

const SINGAPORE_TIME_ZONE = "Asia/Singapore";
const DAY_PATTERN =
  "(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)s?";
const DAY_EXPRESSION = new RegExp(
  `\\b${DAY_PATTERN}\\b(?:\\s*(?:-|to|&|and|/)\\s*\\b${DAY_PATTERN}\\b)*`,
  "gi",
);
const DAILY_PATTERN = /\b(?:daily|every\s*day|everyday)\b/i;
/** Public-holiday notes ("Closed on PH") never change the weekly hours. */
const HOLIDAY_PATTERN = /\b(?:ph|public\s+holidays?|holidays?|eves?)\b/i;

function toDayName(token: string): DayName | undefined {
  const key = token.trim().slice(0, 3).toLowerCase();
  return DAY_ORDER.find((day) => day.toLowerCase() === key);
}

function expandDayRange(start: DayName, end: DayName): DayName[] {
  const startIndex = DAY_ORDER.indexOf(start);
  const endIndex = DAY_ORDER.indexOf(end);
  if (startIndex <= endIndex) return DAY_ORDER.slice(startIndex, endIndex + 1);
  return [...DAY_ORDER.slice(startIndex), ...DAY_ORDER.slice(0, endIndex + 1)];
}

function parseDayExpression(expression: string): DayName[] {
  const days: DayName[] = [];
  const parts = expression.split(/\s*(?:&|and|\/)\s*/i);
  for (const part of parts) {
    const [start, end] = part.split(/\s*(?:-|to)\s*/i);
    const startDay = start ? toDayName(start) : undefined;
    const endDay = end ? toDayName(end) : undefined;
    if (startDay && endDay) days.push(...expandDayRange(startDay, endDay));
    else if (startDay) days.push(startDay);
  }
  return Array.from(new Set(days));
}

/** Time ranges in a piece of text, e.g. "10am - 2pm, 5:30pm-9pm". */
export function parseTimeRanges(text: string): MinuteRange[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (/\b24\s*(?:hours|hrs|h)\b/i.test(trimmed) && !/[ap]\.?m/i.test(trimmed)) {
    return [[0, 24 * 60]];
  }

  const values = [...trimmed.matchAll(/(\d{1,2})(?:[:.](\d{2}))?\s*([ap])?\.?\s*(m)?\b/gi)]
    .map((match) => {
      const hour = Number(match[1]);
      const minute = Number(match[2] ?? "0");
      if (minute > 59 || hour > 24) return null;
      const suffix = match[3] && match[4] ? match[3].toLowerCase() : undefined;
      if (suffix) {
        if (hour > 12) return null;
        return ((hour % 12) + (suffix === "p" ? 12 : 0)) * 60 + minute;
      }
      // 24-hour clock ("0730", "21:00") only counts when written with minutes.
      if (!match[2]) return null;
      return (hour % 24) * 60 + minute;
    })
    .filter((value): value is number => value !== null);

  const ranges: MinuteRange[] = [];
  for (let index = 0; index + 1 < values.length; index += 2) {
    ranges.push([values[index], values[index + 1]]);
  }
  return ranges;
}

/**
 * Parses listed hours into rows. Returns [] when nothing in the text reads as
 * days or times, so callers can show "Hours not listed" instead of guessing.
 */
export function parseOperatingHours(raw: string | undefined): HoursRow[] {
  const cleaned = (raw ?? "")
    .replace(/[–—]/g, "-")
    .replace(/\bweekdays?\b/gi, "Mon-Fri")
    .replace(/\bweekends?\b/gi, "Sat & Sun")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!cleaned) return [];

  const rows: HoursRow[] = [];
  let pendingDays: DayName[] = [];
  const pieces = cleaned
    .split(/[;\n|,]/)
    .map((piece) => piece.trim())
    .filter(Boolean);

  for (const rawPiece of pieces) {
    const piece = rawPiece.replace(/\([^)]*\)/g, " ").trim();
    if (!piece || HOLIDAY_PATTERN.test(piece)) continue;
    const dayMatches = [...piece.matchAll(DAY_EXPRESSION)];
    const isDaily = DAILY_PATTERN.test(piece);
    const pieceDays = dayMatches.flatMap((match) => parseDayExpression(match[0]));
    const remainder = piece
      .replace(DAY_EXPRESSION, " ")
      .replace(DAILY_PATTERN, " ")
      .replace(/^[\s:]+|[\s:]+$/g, "")
      .trim();
    const closed = /\bclosed\b/i.test(remainder);
    const ranges = closed ? [] : parseTimeRanges(remainder);
    const hasTime = closed || ranges.length > 0;

    if (!hasTime) {
      // "Mon, Wed 10am-8pm": a bare day list carries on to the next piece.
      if (pieceDays.length > 0) pendingDays = [...pendingDays, ...pieceDays];
      continue;
    }

    const days = [...pendingDays, ...pieceDays];
    pendingDays = [];
    const previous = rows[rows.length - 1];
    if (days.length === 0 && !isDaily && previous && !previous.closed && !closed) {
      // "Mon-Fri 10am-2pm, 5pm-9pm": a second time range for the same days.
      previous.ranges.push(...ranges);
      previous.text = `${previous.text}, ${remainder}`;
      continue;
    }

    rows.push({
      days: days.length > 0 ? Array.from(new Set(days)) : null,
      closed,
      ranges,
      text: closed ? "Closed" : remainder,
    });
  }

  return rows;
}

/**
 * The hours that apply on `day`: rows naming that day win over a general row,
 * and several rows for the same day ("Mon 10am-2pm; Mon 5pm-9pm") are merged.
 */
export function getHoursForDay(rows: HoursRow[], day: DayName): HoursRow | undefined {
  const general = rows.find((row) => row.days === null);
  const specific = rows.filter((row) => row.days?.includes(day));
  if (specific.length === 0) return general;
  if (specific.length === 1) return specific[0];
  const open = specific.filter((row) => !row.closed);
  if (open.length === 0) return specific[0];
  return {
    days: [day],
    closed: false,
    ranges: open.flatMap((row) => row.ranges),
    text: open.map((row) => row.text).join(", "),
  };
}

function getSingaporeParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SINGAPORE_TIME_ZONE,
    hourCycle: "h23",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? NaN);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? NaN);
  const weekday = toDayName(parts.find((part) => part.type === "weekday")?.value ?? "");
  // Fallback: SGT is UTC+8 with no daylight saving.
  const sgt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return {
    day: weekday ?? DAY_ORDER[(sgt.getUTCDay() + 6) % 7],
    minutes:
      Number.isNaN(hour) || Number.isNaN(minute)
        ? sgt.getUTCHours() * 60 + sgt.getUTCMinutes()
        : (hour % 24) * 60 + minute,
  };
}

/** Minutes since midnight in Singapore. */
export function getSingaporeMinutes(now: Date = new Date()): number {
  return getSingaporeParts(now).minutes;
}

/** Today's weekday in Singapore. */
export function getSingaporeDay(now: Date = new Date()): DayName {
  return getSingaporeParts(now).day;
}

export function formatClockMinutes(minutes: number): string {
  const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const suffix = hour >= 12 ? "pm" : "am";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return minute === 0
    ? `${displayHour}${suffix}`
    : `${displayHour}:${String(minute).padStart(2, "0")}${suffix}`;
}

function isWithin(minutes: number, [start, end]: MinuteRange) {
  if (start === end) return true;
  if (end < start) return minutes >= start || minutes < end;
  return minutes >= start && minutes < end;
}

/**
 * Open, closed or unknown right now in Singapore. `isOpen` is the stored flag:
 * false always means closed. Empty or unreadable hours are "unknown", never
 * "open".
 */
export function getVenueOpenState(
  operatingHours: string | undefined,
  isOpen: boolean,
  now: Date = new Date(),
): OpenState {
  if (!isOpen) return { status: "closed" };
  const rows = parseOperatingHours(operatingHours);
  if (rows.length === 0) return { status: "unknown" };

  const { day, minutes } = getSingaporeParts(now);
  const yesterday = DAY_ORDER[(DAY_ORDER.indexOf(day) + 6) % 7];
  const overnight = getHoursForDay(rows, yesterday)?.ranges.find(
    ([start, end]) => end < start && minutes < end,
  );
  if (overnight) return { status: "open", detail: `Closes ${formatClockMinutes(overnight[1])}` };

  const today = getHoursForDay(rows, day);
  if (!today || today.closed) return { status: "closed", detail: "Closed today" };
  if (today.ranges.length === 0) return { status: "unknown" };

  const current = today.ranges.find(
    (range) => isWithin(minutes, range) && !(range[1] < range[0] && minutes < range[1]),
  );
  if (current) {
    return current[0] === current[1] || (current[0] === 0 && current[1] === 24 * 60)
      ? { status: "open", detail: "Open 24 hours" }
      : { status: "open", detail: `Closes ${formatClockMinutes(current[1])}` };
  }
  const next = today.ranges
    .filter(([start]) => start > minutes)
    .sort((left, right) => left[0] - right[0])[0];
  return next
    ? { status: "closed", detail: `Opens ${formatClockMinutes(next[0])}` }
    : { status: "closed", detail: "Closed for today" };
}

function formatDayList(days: DayName[]): string {
  const indexes = days.map((day) => DAY_ORDER.indexOf(day)).sort((left, right) => left - right);
  if (indexes.length === 7) return "Every day";
  const groups: number[][] = [];
  for (const index of indexes) {
    const group = groups[groups.length - 1];
    if (group && index === group[group.length - 1] + 1) group.push(index);
    else groups.push([index]);
  }
  return groups
    .map((group) =>
      group.length > 2
        ? `${DAY_ORDER[group[0]]}–${DAY_ORDER[group[group.length - 1]]}`
        : group.map((index) => DAY_ORDER[index]).join(", "),
    )
    .join(", ");
}

/** Display rows: one per listed line, without inventing per-day hours. */
export function formatHoursRows(rows: HoursRow[]): { label: string; text: string }[] {
  return rows.map((row) => ({
    label: row.days ? formatDayList(row.days) : "Hours",
    text: row.text,
  }));
}
