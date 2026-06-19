import assert from "node:assert/strict";
import test from "node:test";

import { resolveFeatureFlags } from "@/constants/featureFlags";
import { createRootLinking } from "@/app/navigation/linking";
import { assertRepoFileExists, assertSourceIncludes, readRepoFile } from "@/test/sourceContracts";

const REQUIRED_REPORTS = [
  "tasks/Roadmap/app-production-readiness-audit.md",
  "tasks/Roadmap/app-screen-qc-checklist.md",
  "tasks/Roadmap/app-security-privacy-qc-report.md",
  "tasks/Roadmap/app-accessibility-qc-report.md",
  "tasks/Roadmap/app-performance-qc-report.md",
  "tasks/Roadmap/app-native-build-readiness-report.md",
  "tasks/Roadmap/app-store-submission-checklist.md",
  "tasks/Roadmap/app-monitoring-and-rollback-plan.md",
  "tasks/Roadmap/app-final-go-no-go-checklist.md",
];

test("public-launch readiness report bundle exists and keeps a no-go verdict until external proof lands", () => {
  for (const path of REQUIRED_REPORTS) {
    assertRepoFileExists(path);
  }

  const finalChecklist = readRepoFile("tasks/Roadmap/app-final-go-no-go-checklist.md");
  assert.match(finalChecklist, /Production status:\s+\*\*No-Go\*\*/i);
  assert.match(finalChecklist, /ANDROID_EAS_PROOF=0/);
  assert.match(finalChecklist, /STORE_CONSOLE_PROOF=0/);
  assert.match(finalChecklist, /SUPABASE_OWNER_PROOF=0/);
});

test("production feature flags keep public-launch P0 experimental surfaces disabled", () => {
  const flags = resolveFeatureFlags("production", "production");

  assert.equal(flags.directMessagesEnabled, false);
  assert.equal(flags.commentsEnabled, false);
  assert.equal(flags.oauthProvidersEnabled, false);
  assert.equal(flags.floorplansEnabled, false);
  assert.equal(flags.gamificationEnabled, false);
  assert.equal(flags.collectionsEnabled, false);
  assert.equal(flags.storiesEnabled, false);
  assert.equal(flags.merchantClaimCtaEnabled, false);
  assert.equal(flags.merchantCentreEnabled, false);
  assert.equal(flags.prototypeRoutesEnabled, false);
});

test("root navigation keeps production-disabled routes behind feature flags", () => {
  const rootNavigator = readRepoFile("src/app/navigation/RootNavigator.tsx");

  assertSourceIncludes(
    rootNavigator,
    [
      /FEATURE_FLAGS\.merchantClaimCtaEnabled \? \(/,
      /FEATURE_FLAGS\.directMessagesEnabled \? \(/,
      /FEATURE_FLAGS\.floorplansEnabled \? \(/,
      /FEATURE_FLAGS\.prototypeRoutesEnabled \? \(/,
      /FEATURE_FLAGS\.merchantCentreEnabled \? \(/,
      /FEATURE_FLAGS\.storiesEnabled \? \(/,
      /FEATURE_FLAGS\.gamificationEnabled \? \(/,
      /FEATURE_FLAGS\.collectionsEnabled \? \(/,
    ],
    "RootNavigator feature gates",
  );
});

test("deep links expose only public discovery routes and redirect protected actions when signed out", () => {
  const linking = createRootLinking("exp://127.0.0.1:8081/--/", () => ({
    isAuthReady: true,
    isAuthenticated: false,
  }));
  const screens = linking.config.screens as Record<string, unknown>;

  assert.equal(screens.MerchantTabs, undefined);
  assert.equal(screens.PortfolioPublicView, undefined);
  assert.deepEqual(linking.getStateFromPath("merchant"), undefined);
  assert.deepEqual(linking.getStateFromPath("portfolio/example"), undefined);
  assert.deepEqual(linking.getStateFromPath("order")?.routes?.[0], {
    name: "AuthStack",
    params: { screen: "Login" },
  });
});

test("auth/session storage and logout cleanup keep credentials out of plaintext persisted state", () => {
  const sessionStore = readRepoFile("src/store/useSessionStore.ts");
  const authStorage = readRepoFile("src/lib/services/supabase/authStorage.ts");
  const securityDoc = readRepoFile("SECURITY.md");

  assert.match(
    sessionStore,
    /Supabase refresh\/access tokens stay\s*\/\/ in the dedicated SecureStore-backed auth adapter/,
  );
  assert.match(sessionStore, /clearAccountScopedStores\(\)/);
  assert.match(sessionStore, /getProfileStoreState\(\)\.clearProfile\(\)/);
  assert.match(authStorage, /Production keeps auth material out of plaintext AsyncStorage/);
  assert.match(authStorage, /HUNGRY_ALLOW_INSECURE_AUTH_STORAGE/);
  assert.match(securityDoc, /never written to plain AsyncStorage in production/i);
});
