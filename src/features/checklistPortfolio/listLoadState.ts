/** Where a list screen is in loading its list or items: lets it show a skeleton, an error with Retry, or "not found". */
export type ListLoadState = "loading" | "ready" | "error" | "missing";

/** True when the read reached the server and the list is not there (or not visible). */
export function isListNotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  // PostgREST answers .single() with no row as PGRST116; the mock throws "... not found".
  return code === "PGRST116" || (typeof message === "string" && /not found/i.test(message));
}

export function listLoadStateForError(error: unknown): ListLoadState {
  return isListNotFoundError(error) ? "missing" : "error";
}

/**
 * A short message to show for a failed list write. Errors from the database arrive as
 * plain objects with a `message`, not Error instances; long technical text is replaced.
 */
export function listErrorMessage(error: unknown, fallback: string): string {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  return message && message.length <= 140 ? message : fallback;
}
