const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * "just now", "2 hours ago", "3 days ago", "2 weeks ago", then a short date once it is older
 * than a month ("12 Mar 2026", with the year only when it is not this year).
 */
export function formatRelativeDate(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const elapsed = now.getTime() - then.getTime();
  if (elapsed < MINUTE_MS) return "just now";
  if (elapsed < HOUR_MS) {
    const minutes = Math.floor(elapsed / MINUTE_MS);
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  }
  if (elapsed < DAY_MS) {
    const hours = Math.floor(elapsed / HOUR_MS);
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }
  if (elapsed < 7 * DAY_MS) {
    const days = Math.floor(elapsed / DAY_MS);
    return `${days} ${days === 1 ? "day" : "days"} ago`;
  }
  if (elapsed < 30 * DAY_MS) {
    const weeks = Math.floor(elapsed / (7 * DAY_MS));
    return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  }
  return then.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    ...(then.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

/** "Oct 2026" for a "Member since" line. */
export function formatMemberSince(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-SG", { month: "short", year: "numeric" });
}
