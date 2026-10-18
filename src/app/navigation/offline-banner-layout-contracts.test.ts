import assert from "node:assert/strict";
import test from "node:test";

import { readRepoFile } from "@/test/sourceContracts";

const rootNavigator = readRepoFile("src/app/navigation/RootNavigator.tsx");
const client = readRepoFile("src/lib/services/supabase/client.ts");

function sliceFunction(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} should exist`);
  const next = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, next < 0 ? undefined : next);
}

test("offline banner renders in layout flow, never absolutely over screen headers", () => {
  const banner = sliceFunction(rootNavigator, "OfflineBanner");
  const styles = rootNavigator.slice(rootNavigator.indexOf("const styles = StyleSheet.create"));
  const bannerStyle = styles.slice(
    styles.indexOf("offlineBanner:"),
    styles.indexOf("},", styles.indexOf("offlineBanner:")),
  );

  assert.doesNotMatch(banner, /position:\s*"absolute"/);
  assert.doesNotMatch(bannerStyle, /position:\s*"absolute"/);
  assert.doesNotMatch(rootNavigator, /offlineBannerWrap/);
  // It owns the status-bar inset itself rather than floating over it.
  assert.match(banner, /paddingTop: insets\.top/);
});

test("offline banner stacks above the navigator and hands screens a zero top inset", () => {
  const frame = sliceFunction(rootNavigator, "OfflineAwareFrame");

  assert.match(
    frame,
    /<OfflineBanner \/>[\s\S]*<SafeAreaInsetsContext\.Provider value=\{screenInsets\}>/,
  );
  assert.match(frame, /isOffline \? \{ \.\.\.insets, top: 0 \} : insets/);
  assert.match(rootNavigator, /offlineFrame: \{\s*flex: 1,\s*\}/);
  // The frame wraps the NavigationContainer so detail headers sit below the strip.
  assert.match(rootNavigator, /<OfflineAwareFrame>\s*<NavigationContainer/);
  assert.match(rootNavigator, /<\/NavigationContainer>\s*<\/OfflineAwareFrame>/);
});

test("offline banner keeps alert semantics and a retry action", () => {
  const banner = sliceFunction(rootNavigator, "OfflineBanner");

  assert.match(banner, /accessibilityRole="alert"/);
  assert.match(banner, /accessibilityLiveRegion="polite"/);
  assert.match(banner, /accessibilityLabel="Retry connection"/);
  assert.match(banner, /minHeight: 44/);
});

test("Supabase responses feed connectivity so a stale offline banner clears", () => {
  assert.match(client, /global: \{ fetch: createConnectivityAwareFetch\(/);
});
