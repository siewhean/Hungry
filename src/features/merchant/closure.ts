// A stall's structured temporary closure ("Closed today", "Closed until 3 Nov"), stored as
// merchant_outlets.closed_until. Singapore has no daylight saving, so a day is a fixed +8 hours.
// The wording matches get_public_merchant_profile() so the merchant and the diner read the same.

const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** The furthest ahead a closure can be set (a long closure is a profile change, not a pause). */
export const MAX_CLOSURE_DAYS = 60;

/** The instant the Singapore day after `now` begins. */
export function endOfSingaporeDay(now: Date = new Date()): Date {
  const local = now.getTime() + SGT_OFFSET_MS;
  return new Date(Math.floor(local / DAY_MS) * DAY_MS + DAY_MS - SGT_OFFSET_MS);
}

/** Midnight at the start of a Singapore calendar date ("YYYY-MM-DD"), or null when it is not one. */
export function startOfSingaporeDate(dateOnly: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const utc = Date.UTC(year, month - 1, day);
  const check = new Date(utc);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1) return null;
  return new Date(utc - SGT_OFFSET_MS);
}

/** "YYYY-MM-DD" of the Singapore day containing `date`, shifted by `addDays`. */
export function singaporeDateOnly(date: Date = new Date(), addDays = 0): string {
  const shifted = new Date(date.getTime() + SGT_OFFSET_MS + addDays * DAY_MS);
  return shifted.toISOString().slice(0, 10);
}

export function isClosureActive(closedUntil: string | null | undefined, now: Date = new Date()) {
  if (!closedUntil) return false;
  const until = new Date(closedUntil).getTime();
  return Number.isFinite(until) && until > now.getTime();
}

/** "Closed today", "Closed until 3 Nov", or undefined when there is no active closure. */
export function getClosureLabel(
  closedUntil: string | null | undefined,
  now: Date = new Date(),
): string | undefined {
  if (!closedUntil || !isClosureActive(closedUntil, now)) return undefined;
  const until = new Date(closedUntil);
  if (until.getTime() <= endOfSingaporeDay(now).getTime()) return "Closed today";
  const day = new Date(until.getTime() + SGT_OFFSET_MS);
  const month = day.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  return `Closed until ${day.getUTCDate()} ${month}`;
}

/** The merchant's "Closed until a date" choice; a message when the date cannot be used. */
export function resolveClosedUntil(
  dateOnly: string,
  now: Date = new Date(),
): { closedUntil: string } | { error: string } {
  const start = startOfSingaporeDate(dateOnly.trim());
  if (!start) return { error: "Enter the date as YYYY-MM-DD." };
  if (start.getTime() <= endOfSingaporeDay(now).getTime()) {
    return { error: "Pick a date after today, or choose Closed today." };
  }
  if (start.getTime() - now.getTime() > MAX_CLOSURE_DAYS * DAY_MS) {
    return { error: `Pick a date within ${MAX_CLOSURE_DAYS} days.` };
  }
  return { closedUntil: start.toISOString() };
}
