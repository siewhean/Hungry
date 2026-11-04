/**
 * Supabase returns errors as plain objects ({ code, message, details, hint }); Sentry titles those
 * "anonymous" and groups them all together. Wrap them in an Error that carries the message.
 */
export function asError(error: unknown): unknown {
  if (error instanceof Error || typeof error !== "object" || error === null) return error;
  const { message, code, details, hint } = error as Record<string, unknown>;
  if (typeof message !== "string" || !message) return error;
  const wrapped = new Error(typeof code === "string" ? `${message} (${code})` : message);
  wrapped.name = "SupabaseError";
  Object.assign(wrapped, { code, details, hint });
  return wrapped;
}
