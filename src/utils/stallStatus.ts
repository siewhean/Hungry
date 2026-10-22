import { getSingaporeMinutes, getVenueOpenState } from "@/utils/operatingHours";

export type StallStatus = "open" | "closing_soon" | "closed" | "unknown";

interface OpeningHours {
  open: string; // "HH:mm"
  close: string; // "HH:mm"
}

/**
 * True when the stall reads as open now in Singapore. Uses the shared per-day
 * parser, so "Closed Sun" only closes Sundays. When the hours are empty or
 * unreadable it falls back to the stored `isOpen` flag; detail pages use
 * getVenueOpenState to show "Hours not listed" instead.
 */
export function isVenueOpenFromHours(operatingHours: string | undefined, isOpen: boolean): boolean {
  const state = getVenueOpenState(operatingHours, isOpen);
  return state.status === "unknown" ? isOpen : state.status === "open";
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

  // Singapore time, not the device zone: a stall is open when Singapore says so.
  const currentTimeMinutes = getSingaporeMinutes(now);
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
