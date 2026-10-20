/**
 * Singapore postal-code lookup through OneMap (Singapore Land Authority). The elastic search
 * endpoint needs no API key. Requests only ever go to ONEMAP_HOST over HTTPS.
 */
import type { Coordinate } from "@/types/domain";

export const ONEMAP_HOST = "www.onemap.gov.sg";
/** Hosts the app fetches data from directly (not Supabase). */
export const ALLOWED_FETCH_HOSTS = new Set([ONEMAP_HOST]);
export const SINGAPORE_POSTAL_CODE_PATTERN = /^\d{6}$/;

export type OneMapAddress = {
  postalCode: string;
  /** e.g. "1 KADAYANALLUR STREET MAXWELL FOOD CENTRE SINGAPORE 069184" */
  address: string;
  building?: string;
  coordinate: Coordinate;
};

type OneMapResult = {
  ADDRESS?: string;
  BUILDING?: string;
  POSTAL?: string;
  LATITUDE?: string;
  LONGITUDE?: string;
};

// Built as a string: React Native's URL has no searchParams setters.
export function buildOneMapSearchUrl(postalCode: string): string {
  return (
    `https://${ONEMAP_HOST}/api/common/elastic/search` +
    `?searchVal=${encodeURIComponent(postalCode)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`
  );
}

/** Only https://www.onemap.gov.sg is fetched; anything else is refused. */
export function assertAllowedFetchUrl(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !ALLOWED_FETCH_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error("Blocked request to a non-allowlisted host.");
  }
}

export function isInSingapore({ latitude, longitude }: Coordinate): boolean {
  return latitude >= 1.1 && latitude <= 1.5 && longitude >= 103.5 && longitude <= 104.1;
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.toUpperCase() !== "NIL" ? trimmed : undefined;
}

/** The first result whose postal code matches exactly, or null. */
export function parseOneMapPostalResponse(postalCode: string, body: unknown): OneMapAddress | null {
  const results = (body as { results?: OneMapResult[] } | null)?.results;
  if (!Array.isArray(results)) return null;
  for (const result of results) {
    if (clean(result.POSTAL) !== postalCode) continue;
    const coordinate = {
      latitude: Number(result.LATITUDE),
      longitude: Number(result.LONGITUDE),
    };
    const address = clean(result.ADDRESS);
    if (!address || !Number.isFinite(coordinate.latitude) || !isInSingapore(coordinate)) continue;
    return { postalCode, address, building: clean(result.BUILDING), coordinate };
  }
  return null;
}

/** Looks up a 6-digit Singapore postal code. Resolves null when OneMap has no match. */
export async function lookupPostalCode(
  postalCode: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OneMapAddress | null> {
  const code = postalCode.trim();
  if (!SINGAPORE_POSTAL_CODE_PATTERN.test(code)) {
    throw new Error("Enter a 6-digit Singapore postal code.");
  }
  const url = buildOneMapSearchUrl(code);
  assertAllowedFetchUrl(url);
  const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Postal code lookup is unavailable. Try again later.");
  return parseOneMapPostalResponse(code, await response.json());
}
