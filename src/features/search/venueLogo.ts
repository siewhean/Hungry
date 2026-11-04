const CLEARBIT_LOGO_HOST = "logo.clearbit.com";
const STORAGE_OBJECT_PATH = "/storage/v1/object/public/";

function normalizeUrl(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.includes(",")) return undefined;
  return trimmed;
}

export function getVenueLogoDomain(logoUrl?: string) {
  const normalized = normalizeUrl(logoUrl);
  if (!normalized) return undefined;

  try {
    const url = new URL(normalized);
    // Our own stored copy says nothing about the brand's domain, so it gets no favicon fallback.
    if (url.pathname.startsWith(STORAGE_OBJECT_PATH)) return undefined;
    if (url.hostname === CLEARBIT_LOGO_HOST) {
      return url.pathname.replace(/^\/+/, "").split("/")[0]?.toLowerCase() || undefined;
    }
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return undefined;
  }
}

export function getVenueLogoCandidates(logoUrl?: string) {
  const normalized = normalizeUrl(logoUrl);
  const domain = getVenueLogoDomain(normalized);
  const candidates = [
    normalized,
    domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : undefined,
    domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : undefined,
  ].filter((candidate): candidate is string => Boolean(candidate));

  return [...new Set(candidates)];
}

export function getVenueLogoInitials(name?: string | null) {
  // Some catalog rows reach the app without a venue name; the identity mark must still render.
  const words = (name ?? "")
    .replace(/&/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/gi, ""))
    .filter((word) => word.length > 0 && !/^(pte|ltd|llp|inc|co)$/i.test(word));

  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}
