import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const source = readFileSync(path.join(process.cwd(), "src/hooks/useAppBootstrap.ts"), "utf8");
const offlineScreen = readFileSync(
  path.join(process.cwd(), "src/app/screens/detail/OfflineStateScreen.tsx"),
  "utf8",
);

test("app bootstrap derives offline state from NetInfo and cleans up its subscription", () => {
  assert.match(source, /import NetInfo from "@react-native-community\/netinfo"/);
  assert.match(source, /const unsubscribe = NetInfo\.addEventListener/);
  assert.match(
    source,
    /setOffline\(isNetworkOffline\(state\)\)/,
  );
  assert.match(source, /return unsubscribe;/);
  assert.doesNotMatch(source, /setOffline\(false\);/);
});

test("offline recovery retries NetInfo instead of pretending the connection returned", () => {
  assert.match(offlineScreen, /await NetInfo\.refresh\(\)/);
  assert.match(offlineScreen, /setOffline\(isNetworkOffline\(state\)\)/);
  assert.match(offlineScreen, /label="Retry connection"/);
  assert.doesNotMatch(offlineScreen, /setOffline\(false\)/);
});

test("Supabase cache warm-up does not block app-shell readiness", () => {
  const cacheWarmupIndex = source.indexOf("void refreshSupabaseRepositoryCache()");
  const readyIndex = source.lastIndexOf("setIsDataSourceReady(true);", cacheWarmupIndex);

  assert.ok(readyIndex >= 0 && readyIndex < cacheWarmupIndex);
  assert.doesNotMatch(source, /refreshSupabaseRepositoryCache\(\)[\s\S]{0,240}\.finally\(/);
});
