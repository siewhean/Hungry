// Unit tests (`npm test`) run in plain Node, where @sentry/react-native cannot load because it
// imports react-native. reportError only needs captureException.
export function captureException(_error: unknown, _context?: unknown): void {}
