import assert from "node:assert/strict";
import test from "node:test";

import { readRepoFile } from "@/test/sourceContracts";

function typedRootRoutes(): Set<string> {
  const types = readRepoFile("src/app/navigation/navigationTypes.ts");
  const [, body = ""] = types.match(/export type RootStackParamList = \{([\s\S]*?)\n\};/) ?? [];
  return new Set(Array.from(body.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*):/gm), ([, name]) => name));
}

function registeredRootRoutes(): Set<string> {
  const rootNavigator = readRepoFile("src/app/navigation/RootNavigator.tsx");
  return new Set(
    Array.from(
      rootNavigator.matchAll(/<RootStack\.Screen[\s\S]*?name="([^"]+)"/g),
      ([, name]) => name,
    ),
  );
}

test("root route type inventory matches registered root routes except documented nested-only routes", () => {
  const typedRoutes = typedRootRoutes();
  const registeredRoutes = registeredRootRoutes();
  const nestedOnlyProfileRoutes = new Set(["ChecklistDetail", "PortfolioDetail"]);
  const missingRegistrations = [...typedRoutes].filter(
    (route) => !registeredRoutes.has(route) && !nestedOnlyProfileRoutes.has(route),
  );

  assert.deepEqual(missingRegistrations, []);

  const profileStack = readRepoFile("src/app/screens/profile/ProfileStack.tsx");
  assert.match(profileStack, /<Stack\.Screen name="ChecklistDetail"/);
  assert.match(profileStack, /<Stack\.Screen name="PortfolioDetail"/);
  assert.match(profileStack, /FEATURE_FLAGS\.collectionsEnabled \? \(/);
});

test("production audit classifies mobile content as authenticated and advanced routes as role or feature gated", () => {
  const audit = readRepoFile("tasks/Roadmap/app-production-readiness-audit.md");
  const rootNavigator = readRepoFile("src/app/navigation/RootNavigator.tsx");
  const linking = readRepoFile("src/app/navigation/linking.ts");

  assert.match(audit, /Hungry does not support guest mode|No guest mode/i);
  assert.match(audit, /\| `WheelStack\/\*` \| Decide wheel \| authenticated\/shared/);
  assert.match(audit, /\| `Crave` \| Crave \| authenticated browse/);
  assert.match(audit, /\| `ActivityInbox` \| Activity updates \| authenticated\/private/);
  assert.match(audit, /\| `MusicSelection` \| Music selection \| authenticated flow/);
  assert.match(audit, /No route in this table is classified as guest\/public mobile browsing/);

  assert.match(rootNavigator, /"ActivityInbox"/);
  assert.match(rootNavigator, /"MusicSelection"/);
  assert.match(linking, /"ActivityInbox"/);
  assert.match(linking, /"MusicSelection"/);
});
