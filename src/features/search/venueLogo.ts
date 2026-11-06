import chainLogoDomains from "@/constants/chainLogoDomains.json";

const CLEARBIT_LOGO_HOST = "logo.clearbit.com";
const STORAGE_OBJECT_PATH = "/storage/v1/object/public/";
const CHAIN_DOMAINS = chainLogoDomains as Record<string, string>;

function normalizeChainName(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Matches a venue name to a verified chain ("Nandos - Bugis" -> nandos). Exact or prefix on a word boundary. */
export function getChainLogoDomain(name?: string | null) {
  if (!name) return undefined;
  const normalized = normalizeChainName(name);
  if (!normalized) return undefined;
  if (CHAIN_DOMAINS[normalized]) return CHAIN_DOMAINS[normalized];
  const chain = Object.keys(CHAIN_DOMAINS)
    .filter((key) => normalized.startsWith(`${key} `))
    .sort((a, b) => b.length - a.length)[0];
  return chain ? CHAIN_DOMAINS[chain] : undefined;
}

/** Brandfetch needs a public client id; without it the chain logo is simply skipped. */
export function getBrandfetchLogoUrl(name?: string | null) {
  const clientId = process.env.EXPO_PUBLIC_BRANDFETCH_CLIENT_ID?.trim();
  const domain = getChainLogoDomain(name);
  if (!domain || !clientId) return undefined;
  return `https://cdn.brandfetch.io/${domain}?c=${clientId}`;
}

function isStoredLogo(value?: string) {
  if (!value) return false;
  try {
    return new URL(value).pathname.startsWith(STORAGE_OBJECT_PATH);
  } catch {
    return false;
  }
}

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

export function getVenueLogoCandidates(logoUrl?: string, name?: string | null) {
  const normalized = normalizeUrl(logoUrl);
  const domain = getVenueLogoDomain(normalized);
  const chainLogo = getBrandfetchLogoUrl(name);
  // Our own stored copy always wins; the chain logo only fills in for venues without one.
  const candidates = [
    ...(isStoredLogo(normalized) ? [normalized, chainLogo] : [chainLogo, normalized]),
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
