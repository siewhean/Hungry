export const ATTRIBUTION_STORAGE_KEY = "hungry_attribution_v1";

export const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "ref",
  "landing_path",
  "referrer_host",
] as const;

export type Attribution = Partial<Record<(typeof ATTRIBUTION_KEYS)[number], string>>;

const MAX_VALUE_LENGTH = 100;

export function cleanAttribution(value: unknown): Attribution {
  const result: Attribution = {};
  if (typeof value !== "object" || value === null) return result;

  for (const key of ATTRIBUTION_KEYS) {
    const raw = (value as Record<string, unknown>)[key];
    if (typeof raw === "string" && raw.trim()) {
      result[key] = raw.trim().slice(0, MAX_VALUE_LENGTH);
    }
  }
  return result;
}

export function readStoredAttribution(): Attribution {
  try {
    const stored = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    return stored ? cleanAttribution(JSON.parse(stored)) : {};
  } catch {
    return {};
  }
}

// First campaign touch wins: a stored utm_source or ref is never replaced, and a
// later direct visit cannot erase it. A plain first visit is kept until a visit
// with campaign parameters arrives.
export function captureAttribution() {
  try {
    const stored = readStoredAttribution();
    if (stored.utm_source || stored.ref) return;

    const params = new URLSearchParams(window.location.search);
    const found: Attribution = {};
    for (const key of ATTRIBUTION_KEYS) {
      const value = params.get(key);
      if (value) found[key] = value;
    }

    let referrerHost: string | undefined;
    try {
      const host = document.referrer ? new URL(document.referrer).hostname : "";
      if (host && host !== window.location.hostname) referrerHost = host;
    } catch {
      // Malformed referrer; ignore.
    }

    if (Object.keys(stored).length > 0 && !found.utm_source && !found.ref) return;

    const attribution = cleanAttribution({
      ...found,
      landing_path: window.location.pathname,
      referrer_host: referrerHost,
    });
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
  } catch {
    // Storage can be blocked; attribution is best effort.
  }
}
