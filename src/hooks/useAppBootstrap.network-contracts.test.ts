import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const source = readFileSync(path.join(process.cwd(), "src/hooks/useAppBootstrap.ts"), "utf8");
const offlineScreen = readFileSync(
  path.join(process.cwd(), "src/app/screens/detail/OfflineStateScreen.tsx"),
  "utf8",
);

test("app bootstrap keeps authenticated catalog routes mounted during NetInfo outages", () => {
  assert.match(source, /import NetInfo from "@react-native-community\/netinfo"/);
  assert.match(source, /const unsubscribe = NetInfo\.addEventListener/);
  // Offline is a non-blocking banner; the RootNavigator no longer swaps the
  // current (authenticated catalog) route for the Offline screen.
  assert.match(source, /setOffline\(isNetworkOffline\(state\)\)/);
  const rootNavigator = readFileSync(
    path.join(process.cwd(), "src/app/navigation/RootNavigator.tsx"),
    "utf8",
  );
  assert.match(rootNavigator, /function OfflineBanner\(\)/);
  assert.doesNotMatch(rootNavigator, /navigationRef\.navigate\("Offline"\)/);
  assert.match(source, /return unsubscribe;/);
  assert.doesNotMatch(source, /setOffline\(false\);/);
});

test("offline recovery retries NetInfo instead of pretending the connection returned", () => {
  assert.match(offlineScreen, /await NetInfo\.refresh\(\)/);
  assert.match(offlineScreen, /setOffline\(isNetworkOffline\(state\)\)/);
  assert.match(offlineScreen, /label="Retry connection"/);
  assert.doesNotMatch(offlineScreen, /setOffline\(false\)/);
});

test("Supabase legacy cache warm-up is opt-in and never blocks app-shell readiness", () => {
  const cacheWarmupIndex = source.indexOf("void refreshSupabaseRepositoryCache()");
  const readyIndex = source.lastIndexOf("setIsDataSourceReady(true);", cacheWarmupIndex);

  assert.match(source, /EXPO_PUBLIC_HUNGRY_LEGACY_CACHE_WARMUP === "1"/);
  assert.match(source, /if \(shouldWarmLegacyRepositoryCache\(\)\)/);
  assert.ok(readyIndex >= 0 && readyIndex < cacheWarmupIndex);
  assert.match(source, /runAfterIdle\(\(\) => \{[\s\S]*refreshSupabaseRepositoryCache\(\)/);
  assert.doesNotMatch(source, /refreshSupabaseRepositoryCache\(\)[\s\S]{0,240}\.finally\(/);
});
