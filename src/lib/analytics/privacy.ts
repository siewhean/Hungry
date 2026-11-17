type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const SENSITIVE_KEY_PATTERN =
  /(^|[_-])(email|phone|token|secret|password|authorization|auth|cookie|session|dsn|key)|email$|phone(number)?$|token$|secret$|password$|authorization$|auth$|cookie$|session$|dsn$|key$/i;
const URL_QUERY_PATTERN = /([?&])[^=\s]+=[^#\s]+/g;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const TOKEN_ASSIGNMENT_PATTERN =
  /\b(access_token|refresh_token|token|secret|password|authorization|auth|key)\s*[:=]\s*[^&\s,;]+/gi;

function sanitizeString(value: string): string {
  return value
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(PHONE_PATTERN, "[redacted-phone]")
    .replace(TOKEN_ASSIGNMENT_PATTERN, "$1=[redacted]")
    .replace(URL_QUERY_PATTERN, "$1[redacted]=[redacted]");
}

function isCoordinateKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    normalized === "latitude" ||
    normalized === "longitude" ||
    normalized.endsWith("_lat") ||
    normalized.endsWith("_lng")
  );
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

export function sanitizeAnalyticsProperties(
  properties: Record<string, unknown>,
): Record<string, JsonValue> {
  return Object.fromEntries(
    Object.entries(properties)
      .map(([key, value]) => {
        const sanitized = sanitizeValue(key, value);
        return sanitized === undefined ? null : ([key, sanitized] as const);
      })
      .filter((entry): entry is readonly [string, JsonValue] => entry !== null),
  );
}

function sanitizeTelemetryObject(value: Record<string, unknown>): Record<string, JsonValue> {
  return sanitizeAnalyticsProperties(value);
}

export function sanitizeSentryEvent<T extends object>(event: T): T {
  const source = event as Record<string, unknown>;
  const user = source.user as Record<string, unknown> | undefined;
  const extra = source.extra as Record<string, unknown> | undefined;
  const tags = source.tags as Record<string, unknown> | undefined;
  const contexts = source.contexts as Record<string, unknown> | undefined;
  const request = source.request as Record<string, unknown> | undefined;
  const exception = source.exception as { values?: Record<string, unknown>[] } | undefined;
  const breadcrumbs = source.breadcrumbs as Record<string, unknown>[] | undefined;
  const sanitizedUser = user ? sanitizeAnalyticsProperties(user) : undefined;
  const sanitizedExtra = extra ? sanitizeAnalyticsProperties(extra) : undefined;
  const sanitizedTags = tags ? sanitizeAnalyticsProperties(tags) : undefined;
  const sanitizedContexts = contexts ? sanitizeTelemetryObject(contexts) : undefined;
  const sanitizedRequest = request ? sanitizeTelemetryObject(request) : undefined;
  const sanitizedException = exception?.values
    ? {
        ...exception,
        values: exception.values.map((entry) => ({
          ...sanitizeTelemetryObject(entry),
          ...(typeof entry.value === "string" ? { value: sanitizeString(entry.value) } : {}),
        })),
      }
    : exception;
  const sanitizedBreadcrumbs = breadcrumbs?.map((breadcrumb) => ({
    ...sanitizeTelemetryObject(breadcrumb),
    ...(typeof breadcrumb.message === "string"
      ? { message: sanitizeString(breadcrumb.message) }
      : {}),
    ...(breadcrumb.data && typeof breadcrumb.data === "object"
      ? { data: sanitizeTelemetryObject(breadcrumb.data as Record<string, unknown>) }
      : {}),
  }));

  if (sanitizedUser) {
    const userWithoutEmail = { ...sanitizedUser };
    delete userWithoutEmail.email;
    delete userWithoutEmail.username;
    return {
      ...event,
      user: userWithoutEmail,
      ...(sanitizedExtra ? { extra: sanitizedExtra } : {}),
      ...(sanitizedTags ? { tags: sanitizedTags } : {}),
      ...(sanitizedContexts ? { contexts: sanitizedContexts } : {}),
      ...(sanitizedRequest ? { request: sanitizedRequest } : {}),
      ...(sanitizedException ? { exception: sanitizedException } : {}),
      ...(sanitizedBreadcrumbs ? { breadcrumbs: sanitizedBreadcrumbs } : {}),
    } as T;
  }

  return {
    ...event,
    ...(sanitizedExtra ? { extra: sanitizedExtra } : {}),
    ...(sanitizedTags ? { tags: sanitizedTags } : {}),
    ...(sanitizedContexts ? { contexts: sanitizedContexts } : {}),
    ...(sanitizedRequest ? { request: sanitizedRequest } : {}),
    ...(sanitizedException ? { exception: sanitizedException } : {}),
    ...(sanitizedBreadcrumbs ? { breadcrumbs: sanitizedBreadcrumbs } : {}),
  } as T;
}

export function sanitizeSentryBreadcrumb<T extends object>(breadcrumb: T): T {
  const source = breadcrumb as Record<string, unknown>;
  const sanitized = sanitizeTelemetryObject(source);
  return {
    ...breadcrumb,
    ...sanitized,
    ...(typeof source.message === "string" ? { message: sanitizeString(source.message) } : {}),
    ...(source.data && typeof source.data === "object"
      ? { data: sanitizeTelemetryObject(source.data as Record<string, unknown>) }
      : {}),
  } as T;
}
