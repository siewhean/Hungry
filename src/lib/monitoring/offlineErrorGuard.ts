type GlobalHandler = (error: unknown, isFatal?: boolean) => void;

export interface ErrorUtilsLike {
  getGlobalHandler(): GlobalHandler;
  setGlobalHandler(handler: GlobalHandler): void;
}

const CONNECTION_MESSAGE =
  /network request failed|failed to fetch|network error|no internet|internet connection appears|offline|timed out|timeout|unable to resolve host|connection (?:was )?lost|could not connect/i;
const CONNECTION_NAMES = new Set([
  "CatalogUnavailableError",
  "AuthRetryableFetchError",
  "FunctionsFetchError",
]);

/** True for a failure that only means the phone cannot reach the server right now. */
export function isConnectionError(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== "object" || depth > 3) return false;
  const { name, message, cause } = error as { name?: unknown; message?: unknown; cause?: unknown };
  if (typeof name === "string" && CONNECTION_NAMES.has(name)) return true;
  if (typeof message === "string" && CONNECTION_MESSAGE.test(message)) return true;
  return cause ? isConnectionError(cause, depth + 1) : false;
}

/**
 * React Native closes a release app on an uncaught JS error, e.g. one thrown from a timer or an
 * event handler. With no signal that is just a failed request, so such errors are reported and
 * dropped (the screens already show their retry state); every other error keeps the default.
 */
export function installOfflineErrorGuard(
  errorUtils: ErrorUtilsLike | undefined = (globalThis as { ErrorUtils?: ErrorUtilsLike })
    .ErrorUtils,
  report: (error: unknown, context: Record<string, string | boolean>) => void = (error, context) =>
    (require("./reportError") as typeof import("./reportError")).reportError(error, context),
): boolean {
  if (!errorUtils) return false;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    if (isConnectionError(error)) {
      report(error, { area: "offline_guard", fatal: Boolean(isFatal) });
      return;
    }
    previous?.(error, isFatal);
  });
  return true;
}
