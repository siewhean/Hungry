import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(pathFromRoot: string) {
  return readFileSync(resolve(process.cwd(), pathFromRoot), "utf8");
}

test("offline state preserves the active route and exposes a truthful degraded-state banner", () => {
  const navigator = read("src/app/navigation/RootNavigator.tsx");
  const offlineScreen = read("src/app/screens/detail/OfflineStateScreen.tsx");

  assert.match(navigator, /function OfflineStatusBanner\(\)/);
  assert.match(navigator, /Offline — live requests and submissions unavailable/);
  assert.doesNotMatch(navigator, /isOffline && currentTopRoute !== "Offline"/);
  assert.doesNotMatch(navigator, /currentTopRoute === "Offline"[\s\S]{0,300}resetRoot/);
  assert.match(offlineScreen, /Hungry does not currently queue submissions/);
  assert.doesNotMatch(offlineScreen, /Submit actions wait until the connection returns/);
});
