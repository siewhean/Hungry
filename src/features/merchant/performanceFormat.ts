import type { MerchantDailyPoint } from "@/types/domain";

/** 8420 -> "8,420", the same way on every Performance and Home number. */
export function formatCount(value: number): string {
  return Math.round(value).toLocaleString("en-SG");
}

/**
 * "37% of profile visits" - or nothing when the share is not meaningful: no visits, or more
 * menu views than visits (a diner can open the menu again and again), which must never read
 * as more than 100%.
 */
export function formatShare(part: number, whole: number): string | undefined {
  if (whole <= 0 || part < 0 || part > whole) return undefined;
  return `${Math.round((part / whole) * 100)}%`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDay(date: string): { weekday: string; day: number; month: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return {
    weekday: WEEKDAYS[utc.getUTCDay()],
    day: utc.getUTCDate(),
    month: MONTHS[utc.getUTCMonth()],
  };
}

/** "Mon 27 Oct", read out for one bar. */
export function formatChartDate(date: string): string {
  const day = parseDay(date);
  return day ? `${day.weekday} ${day.day} ${day.month}` : date;
}

export interface ChartBar {
  date: string;
  value: number;
  /** 0 to 1 against the tallest bar. */
  ratio: number;
  /** Short axis label: a weekday for a week, the day of the month every few bars for a month. */
  axisLabel: string;
  /** Spoken form: "Mon 27 Oct: 12 profile visits". */
  accessibilityLabel: string;
  /** The same day of the previous period, when the chart compares; drawn as a ghost bar. */
  previousValue?: number;
  /** 0 to 1 on the same scale as `ratio`; 0 when there is no previous bar. */
  previousRatio: number;
}

/**
 * One bar per day. With `previous` (the same number of days before the range), each bar also
 * carries the matching day of that period, on one shared scale so the two can be compared.
 */
export function buildDailyBars(
  series: readonly MerchantDailyPoint[],
  previous?: readonly MerchantDailyPoint[] | null,
): ChartBar[] {
  const compared = previous && previous.length === series.length ? previous : null;
  const max = Math.max(
    0,
    ...series.map((point) => point.profileVisits),
    ...(compared?.map((point) => point.profileVisits) ?? []),
  );
  const weekly = series.length <= 7;
  return series.map((point, index) => {
    const day = parseDay(point.date);
    const showLabel = weekly || index % 5 === 0 || index === series.length - 1;
    const previousValue = compared?.[index].profileVisits;
    const visits = `${formatCount(point.profileVisits)} profile ${
      point.profileVisits === 1 ? "visit" : "visits"
    }`;
    return {
      date: point.date,
      value: point.profileVisits,
      ratio: max > 0 ? point.profileVisits / max : 0,
      axisLabel: !day || !showLabel ? "" : weekly ? day.weekday.slice(0, 2) : String(day.day),
      accessibilityLabel:
        `${formatChartDate(point.date)}: ${visits}` +
        (previousValue === undefined
          ? ""
          : `. ${formatCount(previousValue)} on the same day before`),
      previousValue,
      previousRatio: previousValue !== undefined && max > 0 ? previousValue / max : 0,
    };
  });
}

export interface PeakHourCell {
  /** 0 to 23, Singapore time. */
  hour: number;
  isPeak: boolean;
  /** 1 for the busiest hour; null for an hour that is not a peak. */
  rank: number | null;
}

/** All 24 hours of the day, with the busiest hours marked. The server sends the order, not counts. */
export function buildPeakHourStrip(peakHours: readonly number[]): PeakHourCell[] {
  const rankOf = new Map<number, number>();
  peakHours.forEach((hour, index) => {
    if (Number.isInteger(hour) && hour >= 0 && hour <= 23 && !rankOf.has(hour)) {
      rankOf.set(hour, index + 1);
    }
  });
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    isPeak: rankOf.has(hour),
    rank: rankOf.get(hour) ?? null,
  }));
}

/** One sentence for screen readers and for the card's caption. */
export function describeDailySeries(series: readonly MerchantDailyPoint[]): string {
  if (series.length === 0) return "No daily data yet.";
  const total = series.reduce((sum, point) => sum + point.profileVisits, 0);
  if (total === 0) return "No profile visits in this range yet.";
  const best = series.reduce((top, point) =>
    point.profileVisits > top.profileVisits ? point : top,
  );
  return `${formatCount(total)} profile visits. Busiest day: ${formatChartDate(best.date)} with ${formatCount(best.profileVisits)}.`;
}
