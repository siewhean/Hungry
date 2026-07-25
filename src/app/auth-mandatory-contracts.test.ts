import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("the signed-out app mounts only Splash, Onboarding, and Auth outside the isolated E2E launcher", () => {
  const appBody = read("src/app/AppBody.tsx");
  const preAuth = read("src/app/navigation/PreAuthNavigator.tsx");
  const e2eRuntime = read("src/lib/runtime/e2eDeveloperLauncher.ts");
  const e2eGate = read("src/lib/runtime/e2eDeveloperLauncherGate.ts");

  assert.match(appBody, /isAuthenticated \|\| isE2eDeveloperLauncherAvailable/);
  assert.match(appBody, /<PreAuthNavigator theme=\{theme\} \/>/);
  assert.match(e2eRuntime, /isE2eDeveloperLauncherBuildFor\(extra, Platform\.OS\)/);
  assert.match(e2eGate, /platform === "web"/);
  assert.match(e2eGate, /extra\?\.appEnv === "development"/);
  assert.match(e2eGate, /extra\?\.e2eDeveloperLauncherEnabled === true/);
  assert.match(preAuth, /name="Splash"/);
  assert.match(preAuth, /name="OnboardingStack"/);
  assert.match(preAuth, /name="AuthStack"/);
  assert.doesNotMatch(preAuth, /name="MainTabs"/);
  assert.doesNotMatch(preAuth, /DeveloperLauncher|MerchantTabs|DishDetail|StallDetail/);
});

test("fresh users complete onboarding before the mandatory account step", () => {
  const splash = read("src/app/screens/SplashScreen.tsx");
  const onboarding = read("src/app/screens/onboarding/OnboardingStack.tsx");
  const mandatoryStep = read("src/app/screens/onboarding/MandatoryOnboardingAuthScreen.tsx");
  const welcome = read("src/app/screens/onboarding/WelcomeScreen.tsx");

  const onboardingIndex = splash.indexOf('name: "OnboardingStack"');
  const authIndex = splash.indexOf('name: "AuthStack"');
  assert.ok(onboardingIndex >= 0 && authIndex > onboardingIndex);
  assert.match(onboarding, /name="OnboardingAuth" component=\{MandatoryOnboardingAuthScreen\}/);
  assert.match(mandatoryStep, /completeOnboarding\(\)/);
  assert.match(mandatoryStep, /<OnboardingAuthScreen/);
  assert.doesNotMatch(welcome, /Continue as Guest|Skip Login|Skip login/);
});

test("released builds require Supabase configuration instead of selecting Excel as the app provider", () => {
  const client = read("src/lib/services/supabase/client.ts");
  const appBody = read("src/app/AppBody.tsx");

  assert.match(client, /if \(isReleasedBuild\(\)\) return "supabase"/);
  assert.match(client, /getReleasedSupabaseConfigurationError/);
  assert.match(appBody, /Hungry is temporarily unavailable/);
  assert.match(client, /if \(isReleasedBuild\(\)\) return "supabase";/);
});

test("obsolete guest native entry points are removed from executable scripts", () => {
  const packageJson = read("package.json");
  const runner = read("scripts/run-maestro-smoke.mjs");

  assert.doesNotMatch(packageJson, /smoke:native:(?:ios|android):guest/);
  assert.doesNotMatch(runner, /guest-browse-smoke/);
  assert.match(packageJson, /smoke:native:ios:mandatory-auth/);
  assert.match(packageJson, /smoke:native:android:mandatory-auth/);
});
