// Pure helpers for the Edge Function Sentry wrapper. Kept free of Deno and npm imports so
// the Node test runner can cover them.

const REDACTIONS: [RegExp, string][] = [
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[jwt]"],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [token]"],
  [/\bsk-[A-Za-z0-9_-]{16,}/g, "[api-key]"],
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]"],
];

export function scrubString(value: string): string {
  return REDACTIONS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value,
  );
}

type SentryEventLike = {
  message?: string;
  request?: unknown;
  user?: unknown;
  extra?: Record<string, unknown>;
  exception?: { values?: { value?: string }[] };
};

// Edge Functions see service-role calls and user content, so events carry only the error
// and our own tags: no request body, headers, or user, and secrets/emails stripped from text.
export function scrubEvent<T extends SentryEventLike>(event: T): T {
  const scrubbed: SentryEventLike = { ...event };
  delete scrubbed.request;
  delete scrubbed.user;
  if (typeof scrubbed.message === "string") scrubbed.message = scrubString(scrubbed.message);
  if (scrubbed.exception?.values) {
    scrubbed.exception = {
      ...scrubbed.exception,
      values: scrubbed.exception.values.map((entry) =>
        typeof entry.value === "string" ? { ...entry, value: scrubString(entry.value) } : entry,
      ),
    };
  }
  if (scrubbed.extra) {
    scrubbed.extra = Object.fromEntries(
      Object.entries(scrubbed.extra).map(([key, value]) => [
        key,
        typeof value === "string" ? scrubString(value) : value,
      ]),
    );
  }
  return scrubbed as T;
}
