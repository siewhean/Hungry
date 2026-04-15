const PRE_FORMATTED_RELATIVE_TIME = /^\d+\s*(s|m|h|d|w|mo|y)\s*ago$/i;

export function formatTimeAgo(value: string | Date): string {
  if (value instanceof Date) {
    return formatFromDate(value);
  }

  const trimmed = value.trim();
  if (!trimmed.length) {
    return "just now";
  }

  if (PRE_FORMATTED_RELATIVE_TIME.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  if (trimmed.toLowerCase() === "today") {
    return "today";
  }

  if (trimmed.toLowerCase() === "yesterday") {
    return "1d ago";
  }

  const parsedDate = new Date(trimmed);
  if (Number.isNaN(parsedDate.getTime())) {
    return trimmed;
  }

  return formatFromDate(parsedDate);
}

function formatFromDate(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  if (diffMs <= 30_000) {
    return "just now";
  }

  const seconds = Math.floor(diffMs / 1_000);
  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  const weeks = Math.floor(days / 7);
  if (weeks < 5) {
    return `${weeks}w ago`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months}mo ago`;
  }

  const years = Math.floor(days / 365);
  return `${years}y ago`;
}