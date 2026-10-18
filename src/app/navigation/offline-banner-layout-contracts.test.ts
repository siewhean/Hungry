import assert from "node:assert/strict";
import test from "node:test";

import { readRepoFile } from "@/test/sourceContracts";

const rootNavigator = readRepoFile("src/app/navigation/RootNavigator.tsx");
const client = readRepoFile("src/lib/services/supabase/client.ts");
const banner = readRepoFile("src/components/ui/Banner.tsx");
const bannerTones = readRepoFile("src/components/ui/bannerTones.ts");

function sliceFunction(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} should exist`);
  const next = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, next < 0 ? undefined : next);
}

test("offline banner renders in layout flow, never absolutely over screen headers", () => {
  const offlineBanner = sliceFunction(rootNavigator, "OfflineBanner");

  assert.doesNotMatch(offlineBanner, /position:\s*"absolute"/);
  assert.doesNotMatch(banner, /position:\s*"absolute"/);
  assert.doesNotMatch(rootNavigator, /offlineBannerWrap/);
  // It renders the shared Banner strip, which owns the status-bar inset itself.
  assert.match(offlineBanner, /<Banner[\s\S]*variant="offline"[\s\S]*placement="strip"/);
  assert.match(offlineBanner, /topInset=\{insets\.top\}/);
  assert.match(banner, /paddingTop: topInset \+/);
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
  const offlineBanner = sliceFunction(rootNavigator, "OfflineBanner");

  assert.match(offlineBanner, /accessibilityLabel: "Retry connection"/);
  assert.match(offlineBanner, /testID="offline-banner"/);
  // Alert semantics and 44pt targets come from the shared Banner primitive.
  assert.match(bannerTones, /variant === "offline"/);
  assert.match(banner, /accessibilityRole=\{isAlert \? "alert" : undefined\}/);
  assert.match(banner, /accessibilityLiveRegion=\{isAlert \? "polite" : undefined\}/);
  assert.match(banner, /minHeight: componentSizes\.touchTarget/);
});

test("Supabase responses feed connectivity so a stale offline banner clears", () => {
  assert.match(client, /global: \{ fetch: createConnectivityAwareFetch\(/);
});
