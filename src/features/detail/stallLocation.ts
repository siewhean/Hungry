import type { VenueSummary } from "@/types/domain";

import {
  formatVenueAddress,
  formatVenueAddressLine,
  formatVenueLocationLabel,
} from "./formatVenueAddress";

type BuildingLocation = {
  name?: string;
  address?: string;
  postalCode?: string;
};

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Clean single-line stall address (deduplicated; used for maps search and a11y labels). */
export function formatFullStallAddress(
  venue: Pick<VenueSummary, "name" | "unitNumber">,
  building?: BuildingLocation,
) {
  return formatVenueAddressLine({
    venueName: venue.name,
    unitNumber: venue.unitNumber,
    buildingName: building?.name,
    address: building?.address,
    postalCode: building?.postalCode,
  });
}

/** Organised multi-line stall address: building, street, "Unit #..", "Singapore ......". */
export function formatStallAddressLines(
  venue: Pick<VenueSummary, "name" | "unitNumber">,
  building?: BuildingLocation,
) {
  return formatVenueAddress({
    venueName: venue.name,
    unitNumber: venue.unitNumber,
    buildingName: building?.name,
    address: building?.address,
    postalCode: building?.postalCode,
  }).lines;
}

/** Header subtitle: building / operator name, else a short area. Never a raw address. */
export function formatStallBuildingLabel(
  venue: Pick<VenueSummary, "name" | "planningArea">,
  building?: BuildingLocation & { planningArea?: string },
) {
  return formatVenueLocationLabel({
    venueName: venue.name,
    buildingName: building?.name,
    address: building?.address,
    planningArea: venue.planningArea ?? building?.planningArea,
  });
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
