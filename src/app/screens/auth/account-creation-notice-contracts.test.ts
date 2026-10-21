import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), "utf8");

function listTsx(dir: string): string[] {
  return readdirSync(path.join(root, dir)).flatMap((name) => {
    const relative = path.join(dir, name);
    if (statSync(path.join(root, relative)).isDirectory()) return listTsx(relative);
    return relative.endsWith(".tsx") ? [relative] : [];
  });
}

test("every account-creation form shows the Terms and Privacy notice", () => {
  const notice = read("src/app/screens/auth/AuthTermsNotice.tsx");
  assert.match(notice, /openTrustedExternalUrl\(WEB_LINKS\.terms\)/);
  assert.match(notice, /openTrustedExternalUrl\(WEB_LINKS\.privacy\)/);
  assert.match(notice, /AUTH_COPY\.signUp\.termsPrefix/);

  assert.match(read("src/app/screens/auth/SignUpScreen.tsx"), /<AuthTermsNotice \/>/);
  // The onboarding sign-up form (name, email, password) is where most guests sign up.
  assert.match(
    read("src/app/screens/onboarding/OnboardingAuthScreen.tsx"),
    /label="Create account"[\s\S]*?\/>\s*<AuthTermsNotice \/>/,
  );
});

test("no screen offers Google or Apple sign-in unless the provider flag is on", () => {
  const screens = listTsx("src/app").filter((file) => read(file).includes("<AuthProviderButton"));
  assert.ok(screens.length > 0);
  for (const file of screens) {
    const source = read(file);
    assert.match(source, /FEATURE_FLAGS\.oauthProvidersEnabled/, file);
    // Every provider button sits inside the flag's conditional, so production
    // (flag off) never shows a sign-in option that is not set up.
    const gateStart = source.search(/\{(oauthEnabled|oauthProvidersEnabled) \? \(/);
    assert.ok(gateStart >= 0, file);
    assert.ok(source.indexOf("<AuthProviderButton") > gateStart, file);
  }
  assert.match(
    read("src/constants/featureFlags.ts"),
    /oauthProvidersEnabled: nonProductionSurfaceEnabled/,
  );
});
