export type StallStatus = "open" | "closing_soon" | "closed" | "unknown";

interface OpeningHours {
  open: string; // "HH:mm"
  close: string; // "HH:mm"
}

const SINGAPORE_TIME_ZONE = "Asia/Singapore";

type ParsedTimeRange = [startMinutes: number, endMinutes: number];

function getSingaporeTime(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-SG", {
    timeZone: SINGAPORE_TIME_ZONE,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);

  const hourPart = parts.find((part) => part.type === "hour");
  const minutePart = parts.find((part) => part.type === "minute");

  const hour = Number(hourPart?.value ?? NaN);
  const minute = Number(minutePart?.value ?? NaN);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return (now.getHours() * 60 + now.getMinutes()) % (24 * 60);
  }

  return hour * 60 + minute;
}

function parseOpeningHoursAsMinutes(operatingHours: string): ParsedTimeRange[] {
  const trimmed = operatingHours.trim();
  if (!trimmed) {
    return [];
  }

  if (/\b24\s*hours\b/i.test(trimmed) && !/[AaPp][Mm]/.test(trimmed)) {
    return [[0, 24 * 60]];
  }

  const matches = [...trimmed.matchAll(/(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])?/g)];
  if (matches.length < 2) {
    return [];
  }

  const values = matches
    .map((match) => {
      const hour = Number(match[1]);
      const minute = Number(match[2] ?? "0");
      if (Number.isNaN(hour) || Number.isNaN(minute) || minute > 59 || hour > 23) {
        return null;
      }

      const suffix = match[3]?.toLowerCase();
      if (suffix === "am" || suffix === "pm") {
        let normalizedHour = hour % 12;
        if (suffix === "pm") {
          normalizedHour += 12;
        }
        return normalizedHour * 60 + minute;
      }

      return hour * 60 + minute;
    })
    .filter((value): value is number => value !== null);

  const pairs: ParsedTimeRange[] = [];
  for (let i = 0; i + 1 < values.length; i += 2) {
    const start = values[i];
    const end = values[i + 1];
    pairs.push([start, end]);
  }

  return pairs;
}

function isTimeInRange(currentMinutes: number, startMinutes: number, endMinutes: number): boolean {
  if (startMinutes === endMinutes) {
    return true;
  }

  if (endMinutes < startMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

export function isVenueOpenFromHours(operatingHours: string | undefined, isOpen: boolean): boolean {
  if (!isOpen) {
    return false;
  }

  const normalizedHours = (operatingHours ?? "").trim();
  if (!normalizedHours) {
    return true;
  }

  if (/\bclosed\b/i.test(normalizedHours)) {
    return false;
  }

  const ranges = parseOpeningHoursAsMinutes(normalizedHours);
  if (ranges.length === 0) {
    return true;
  }

  const currentMinutes = getSingaporeTime();
  return ranges.some(([start, end]) => isTimeInRange(currentMinutes, start, end));
}

export function computeStallStatus(
  hours: OpeningHours | undefined,
  now: Date = new Date(),
  closingSoonThresholdMinutes: number = 60,
): StallStatus {
  if (!hours || !hours.open || !hours.close) {
    return "unknown";
  }

  const [openH, openM] = hours.open.split(":").map(Number);
  const [closeH, closeM] = hours.close.split(":").map(Number);

  const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
  const openTimeMinutes = openH * 60 + openM;
  let closeTimeMinutes = closeH * 60 + closeM;

  // Handle overnight closing (e.g., 22:00 to 02:00)
  if (closeTimeMinutes < openTimeMinutes) {
    closeTimeMinutes += 24 * 60;
    if (currentTimeMinutes < openTimeMinutes) {
      // It's after midnight but before the next day's opening
      // We need to check if it's still open from the previous day
      // But for this simple logic, we'll just check if current time + 24h is within the range
      const adjustedCurrentTime = currentTimeMinutes + 24 * 60;
      if (adjustedCurrentTime >= openTimeMinutes && adjustedCurrentTime < closeTimeMinutes) {
        if (closeTimeMinutes - adjustedCurrentTime <= closingSoonThresholdMinutes) {
          return "closing_soon";
        }
        return "open";
      }
    }
  }

  if (currentTimeMinutes >= openTimeMinutes && currentTimeMinutes < closeTimeMinutes) {
    if (closeTimeMinutes - currentTimeMinutes <= closingSoonThresholdMinutes) {
      return "closing_soon";
    }
    return "open";
  }

  return "closed";
}
