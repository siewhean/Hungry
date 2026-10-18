import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function readRepoFile(pathFromRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

test("App always mounts the root error boundary, with or without a Sentry DSN", () => {
  const app = readRepoFile("App.tsx");

  assert.match(app, /<AppErrorBoundary>/);
  assert.doesNotMatch(app, /shouldEnableSentry \? \(/);
  assert.doesNotMatch(app, /Sentry\.ErrorBoundary/);
  // Sentry wrapping is kept when a DSN exists.
  assert.match(
    app,
    /export default shouldEnableSentry \? Sentry\.wrap\(AppContent\) : AppContent;/,
  );
});

test("root error boundary reports through reportError and offers a restart", () => {
  const boundary = readRepoFile("src/components/ui/ErrorBoundary.tsx");
  const reporter = readRepoFile("src/lib/monitoring/reportError.ts");

  assert.match(boundary, /componentDidCatch[\s\S]*reportError\(error/);
  assert.match(boundary, /Updates\.reloadAsync\(\)/);
  assert.match(boundary, />Restart</);
  assert.match(reporter, /EXPO_PUBLIC_SENTRY_DSN/);
  assert.match(reporter, /Sentry\.captureException\(error/);
});

test("EmptyState hides raw error text and the Send error action in production", () => {
  const emptyState = readRepoFile("src/components/ui/EmptyState.tsx");

  assert.match(emptyState, /const showDebugErrorDetails =/);
  assert.match(emptyState, /EXPO_PUBLIC_APP_ENV !== "production"/);
  assert.match(emptyState, /showDebugErrorDetails && errorMessage \?/);
  assert.match(emptyState, /const resolvedOnSendError = !showDebugErrorDetails\s*\? undefined/);
});
