import type { VenueSummary } from "@/types/domain";

type BuildingLocation = {
  name?: string;
  address?: string;
  postalCode?: string;
};

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function formatFullStallAddress(
  venue: Pick<VenueSummary, "name" | "unitNumber">,
  building?: BuildingLocation,
) {
  return [
    venue.name,
    venue.unitNumber,
    building?.name,
    building?.address,
    building?.postalCode ? `Singapore ${building.postalCode}` : undefined,
  ]
    .filter(Boolean)
    .join(", ");
}

export function formatFoodCentreLocation(building?: BuildingLocation) {
  return [
    building?.name,
    building?.address,
    building?.postalCode ? `Singapore ${building.postalCode}` : undefined,
  ]
    .filter(Boolean)
    .join(", ");
}

export function formatWeeklyOperatingHours(operatingHours?: string) {
  const cleaned = operatingHours?.trim();
  if (!cleaned) return ["Hours unavailable"];

  if (
    /\b(mon|monday|tue|tuesday|wed|wednesday|thu|thursday|fri|friday|sat|saturday|sun|sunday)\b/i.test(
      cleaned,
    )
  ) {
    return cleaned
      .split(/\n|;/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  return WEEKDAYS.map((day) => `${day}: ${cleaned}`);
}

export function buildMapsSearchUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
