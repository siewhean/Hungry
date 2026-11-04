import { promotionBoundaryToDateOnly } from "@/features/merchant/promotionValidation";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Ymd = { year: number; month: number; day: number };

function parseYmd(value: string): Ymd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year: Number(match[1]), month, day: Number(match[3]) };
}

function dayMonth({ day, month }: Ymd): string {
  return `${day} ${MONTHS[month - 1]}`;
}

/**
 * "27 Oct – 3 Nov" for two "YYYY-MM-DD" days. The year appears only when a date is not in the
 * current year (on the end date, and on the start date too when the range spans two years).
 */
export function formatDateOnlyRange(start: string, end: string, now: Date = new Date()): string {
  const from = parseYmd(start);
  const to = parseYmd(end);
  if (!from || !to) return "";
  const thisYear = now.getFullYear();
  const sameDay = from.year === to.year && from.month === to.month && from.day === to.day;
  const spansYears = from.year !== to.year;
  const fromText = spansYears ? `${dayMonth(from)} ${from.year}` : dayMonth(from);
  const showEndYear = spansYears || to.year !== thisYear;
  const toText = showEndYear ? `${dayMonth(to)} ${to.year}` : dayMonth(to);
  return sameDay ? toText : `${fromText} – ${toText}`;
}

/** The same range for a stored promotion, whose dates are Singapore start/end-of-day instants. */
export function formatPromotionRange(
  startDate: string,
  endDate: string,
  now: Date = new Date(),
): string {
  return formatDateOnlyRange(
    promotionBoundaryToDateOnly(startDate, "start"),
    promotionBoundaryToDateOnly(endDate, "end"),
    now,
  );
}
