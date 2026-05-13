export type StallStatus = "open" | "closing_soon" | "closed" | "unknown";

interface OpeningHours {
  open: string; // "HH:mm"
  close: string; // "HH:mm"
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
