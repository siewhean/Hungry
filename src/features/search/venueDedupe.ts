import type { VenueSummary } from "@/types/domain";

const COMPANY_SUFFIX_PATTERN =
  /\b(?:pte\.?\s*ltd\.?|private\s+limited|ltd\.?|llp|management|singapore)\b/g;

function normalizeHost(value: string) {
  return value
    .toLowerCase()
    .replace(/^www\./, "")
    .trim();
}

function getLogoDomain(logoUrl?: string) {
  if (!logoUrl?.trim()) return "";

  try {
    const url = new URL(logoUrl.trim());
    const host = normalizeHost(url.hostname);
    // Stored brand logos share one host, so the file itself identifies the chain.
    if (url.pathname.startsWith("/storage/v1/object/public/")) return `${host}${url.pathname}`;
    if (host === "logo.clearbit.com") {
      const [domain] = url.pathname.split("/").filter(Boolean);
      return domain ? normalizeHost(domain) : "";
    }
    return host;
  } catch {
    return "";
  }
}

/**
 * A brand key that is never derived from the name: the shared logo file when there is one,
 * otherwise the venue's own id. Generic hawker names ("Chicken Rice", "Drinks Stall") belong to
 * unrelated stalls, so a name match alone must not merge two venues.
 */
export function getVenueBrandKey(venue: Pick<VenueSummary, "id" | "logoUrl">) {
  const logoDomain = getLogoDomain(venue.logoUrl);
  return logoDomain ? `logo:${logoDomain}` : `id:${venue.id}`;
}

export function getVenueChainKey(venue: VenueSummary) {
  const logoDomain = getLogoDomain(venue.logoUrl);
  if (logoDomain) return `logo:${logoDomain}`;

  const normalizedName = venue.name
    .toLowerCase()
    .replace(COMPANY_SUFFIX_PATTERN, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+(?:@|at)\s+.+$/g, "")
    .replace(/\s+-\s+.+$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  return `name:${normalizedName || venue.id}`;
}

export function dedupeNearestVenueCandidates<T>(
  items: readonly T[],
  getVenue: (item: T) => VenueSummary | undefined,
  getDistanceMeters: (item: T) => number | undefined,
) {
  const nearestByKey = new Map<string, { distanceMeters: number; item: T; order: number }>();

  items.forEach((item, order) => {
    const venue = getVenue(item);
    if (!venue) {
      nearestByKey.set(`item:${order}`, {
        distanceMeters: Number.MAX_SAFE_INTEGER,
        item,
        order,
      });
      return;
    }

    const distanceMeters = getDistanceMeters(item) ?? Number.MAX_SAFE_INTEGER;
    const key = getVenueChainKey(venue);
    const current = nearestByKey.get(key);
    if (!current || distanceMeters < current.distanceMeters) {
      nearestByKey.set(key, { distanceMeters, item, order });
    }
  });

  return Array.from(nearestByKey.values())
    .sort((left, right) => left.order - right.order)
    .map((entry) => entry.item);
}
