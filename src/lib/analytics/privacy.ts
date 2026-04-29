type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const SENSITIVE_KEY_PATTERN =
  /(^|[_-])(email|phone|token|secret|password|authorization|auth|cookie|session|dsn|key)|email$|phone(number)?$|token$|secret$|password$|authorization$|auth$|cookie$|session$|dsn$|key$/i;
const URL_QUERY_PATTERN = /([?&])[^=\s]+=[^#\s]+/g;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g;

function sanitizeString(value: string): string {
  return value
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(PHONE_PATTERN, "[redacted-phone]")
    .replace(URL_QUERY_PATTERN, "$1[redacted]=[redacted]");
}

function isCoordinateKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return normalized === "latitude" || normalized === "longitude" || normalized.endsWith("_lat") || normalized.endsWith("_lng");
}

function sanitizeValue(key: string, value: unknown): JsonValue | undefined {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return "[redacted]";
  }
  if (typeof value === "string") {
    return sanitizeString(value);
  }
  if (typeof value === "number") {
    return isCoordinateKey(key) ? Number(value.toFixed(3)) : value;
  }
  if (typeof value === "boolean" || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizeValue(key, entry))
      .filter((entry): entry is JsonValue => entry !== undefined);
  }
  if (typeof value === "object" && value) {
    return sanitizeAnalyticsProperties(value as Record<string, unknown>);
  }
  return undefined;
}

export function sanitizeAnalyticsProperties(properties: Record<string, unknown>): Record<string, JsonValue> {
  return Object.fromEntries(
    Object.entries(properties)
      .map(([key, value]) => {
        const sanitized = sanitizeValue(key, value);
        return sanitized === undefined ? null : ([key, sanitized] as const);
      })
      .filter((entry): entry is readonly [string, JsonValue] => entry !== null),
  );
}

export function sanitizeSentryEvent<T extends { user?: Record<string, unknown>; extra?: Record<string, unknown>; tags?: Record<string, unknown> }>(
  event: T,
): T {
  if (event.user) {
    event.user = sanitizeAnalyticsProperties(event.user);
    delete event.user.email;
    delete event.user.username;
  }
  if (event.extra) {
    event.extra = sanitizeAnalyticsProperties(event.extra);
  }
  if (event.tags) {
    event.tags = sanitizeAnalyticsProperties(event.tags);
  }
  return event;
}
