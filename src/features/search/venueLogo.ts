import chainLogoDomains from "@/constants/chainLogoDomains.json";

const CLEARBIT_LOGO_HOST = "logo.clearbit.com";
const BRANDFETCH_CLIENT_ID = process.env.EXPO_PUBLIC_BRANDFETCH_CLIENT_ID?.trim();
const CHAIN_DOMAINS = chainLogoDomains as Record<string, string>;

function normalizeChainName(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Matches a venue name to a verified chain ("Nandos - Bugis" -> nandos). Exact or prefix on word boundary. */
export function getChainLogoDomain(name?: string) {
  if (!name) return undefined;
  const normalized = normalizeChainName(name);
  if (!normalized) return undefined;
  if (CHAIN_DOMAINS[normalized]) return CHAIN_DOMAINS[normalized];
  const chain = Object.keys(CHAIN_DOMAINS)
    .filter((key) => normalized.startsWith(`${key} `))
    .sort((a, b) => b.length - a.length)[0];
  return chain ? CHAIN_DOMAINS[chain] : undefined;
}

export function getBrandfetchLogoUrl(name?: string) {
  const domain = getChainLogoDomain(name);
  if (!domain || !BRANDFETCH_CLIENT_ID) return undefined;
  return `https://cdn.brandfetch.io/${domain}?c=${BRANDFETCH_CLIENT_ID}`;
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
    if (url.hostname === CLEARBIT_LOGO_HOST) {
      return url.pathname.replace(/^\/+/, "").split("/")[0]?.toLowerCase() || undefined;
    }
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return undefined;
  }
}

export function getVenueLogoCandidates(logoUrl?: string, name?: string) {
  const normalized = normalizeUrl(logoUrl);
  const domain = getVenueLogoDomain(normalized);
  const candidates = [
    getBrandfetchLogoUrl(name),
    normalized,
    domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : undefined,
    domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : undefined,
  ].filter((candidate): candidate is string => Boolean(candidate));

  return [...new Set(candidates)];
}

export function getVenueLogoInitials(name: string) {
  const words = name
    .replace(/&/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/gi, ""))
    .filter((word) => word.length > 0 && !/^(pte|ltd|llp|inc|co)$/i.test(word));

  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}
