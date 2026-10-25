export const CONSENT_STORAGE_KEY = "hungry.website-consent.v1";
export const CONSENT_CHANGED_EVENT = "hungry:consent-changed";
export const CONSENT_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

type ConsentRecord = { version: 1; analytics: boolean; expiresAt: number };
let tabChoice: ConsentRecord | undefined;

export function parseConsent(raw: string | null, now = Date.now()): ConsentRecord | null {
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (!value || typeof value !== "object") return null;
    const record = value as Partial<ConsentRecord>;
    if (
      record.version !== 1 ||
      typeof record.analytics !== "boolean" ||
      typeof record.expiresAt !== "number" ||
      !Number.isFinite(record.expiresAt) ||
      record.expiresAt <= now ||
      record.expiresAt > now + CONSENT_MAX_AGE_MS
    )
      return null;
    return record as ConsentRecord;
  } catch {
    return null;
  }
}

export function privacySignalEnabled(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    navigator.doNotTrack === "1" ||
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true
  );
}

export function consentSnapshot(): "unset" | "accepted" | "rejected" {
  if (typeof window === "undefined") return "unset";
  if (privacySignalEnabled()) return "rejected";
  let record = tabChoice && tabChoice.expiresAt > Date.now() ? tabChoice : null;
  if (!record) {
    try {
      record = parseConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY));
    } catch {
      /* Off by default. */
    }
  }
  return record ? (record.analytics ? "accepted" : "rejected") : "unset";
}

export function analyticsAllowed(): boolean {
  if (typeof window === "undefined" || /^\/(merchant|console)(\/|$)/.test(window.location.pathname))
    return false;
  return consentSnapshot() === "accepted";
}

export function saveConsent(analytics: boolean): boolean {
  tabChoice = {
    version: 1,
    analytics: analytics && !privacySignalEnabled(),
    expiresAt: Date.now() + CONSENT_MAX_AGE_MS,
  };
  let remembered = true;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(tabChoice));
  } catch {
    remembered = false;
  }
  window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
  return remembered;
}

export function subscribeConsent(listener: () => void): () => void {
  const syncStorage = () => {
    tabChoice = undefined;
    listener();
  };
  window.addEventListener(CONSENT_CHANGED_EVENT, listener);
  window.addEventListener("storage", syncStorage);
  window.addEventListener("focus", listener);
  // Expiring a consent while the page is open must also unmount optional analytics.
  const timer = window.setInterval(listener, 60_000);
  return () => {
    window.removeEventListener(CONSENT_CHANGED_EVENT, listener);
    window.removeEventListener("storage", syncStorage);
    window.removeEventListener("focus", listener);
    window.clearInterval(timer);
  };
}

// Do not send email addresses, tokens or search terms embedded in query strings.
export function filterAnalyticsEvent<T extends { url: string }>(event: T): T | null {
  if (!analyticsAllowed()) return null;
  try {
    const url = new URL(event.url);
    if (/^\/(merchant|console)(\/|$)/.test(url.pathname)) return null;
    return { ...event, url: `${url.origin}${url.pathname}` };
  } catch {
    return null;
  }
}
