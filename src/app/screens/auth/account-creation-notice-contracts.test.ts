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
  // The email-code form can create an account from Login too, so Login says "By continuing".
  assert.match(
    read("src/app/screens/auth/LoginScreen.tsx"),
    /<AuthTermsNotice prefix=\{AUTH_COPY\.emailCode\.termsPrefix\} \/>/,
  );
  // The onboarding account step (code form and password form) is where most guests sign up.
  const onboardingAuth = read("src/app/screens/onboarding/OnboardingAuthScreen.tsx");
  assert.match(onboardingAuth, /<AuthTermsNotice prefix=\{AUTH_COPY\.emailCode\.termsPrefix\} \/>/);
  assert.match(onboardingAuth, /label="Create account"[\s\S]*?<AuthTermsNotice \/>/);
});

test("no screen offers Google or Apple sign-in unless the provider flag is on", () => {
  // Only AuthProviderButtons renders provider buttons, from the list authProviders.ts builds.
  const screens = listTsx("src/app").filter((file) => /<AuthProviderButton[\s/>]/.test(read(file)));
  assert.deepEqual(screens, ["src/app/screens/auth/AuthProviderButtons.tsx"]);
  assert.match(read("src/app/screens/auth/AuthProviderButtons.tsx"), /getEnabledAuthProviders\(\)/);
  const providers = read("src/app/screens/auth/authProviders.ts");
  assert.match(providers, /flags\.oauthProvidersEnabled/);
  assert.match(providers, /flags\.googleSignInEnabled && platform !== "ios"/);
  for (const file of ["LoginScreen", "SignUpScreen"]) {
    assert.match(read(`src/app/screens/auth/${file}.tsx`), /<AuthProviderButtons/, file);
  }
  assert.match(read("src/app/screens/onboarding/OnboardingAuthScreen.tsx"), /<AuthProviderButtons/);
  assert.match(
    read("src/constants/featureFlags.ts"),
    /oauthProvidersEnabled: nonProductionSurfaceEnabled/,
  );
  // Google opts in per build; production stays off until it is configured.
  assert.match(
    read("src/constants/featureFlags.ts"),
    /googleSignInEnabled: surface\("EXPO_PUBLIC_ENABLE_GOOGLE_SIGN_IN", nonProductionSurfaceEnabled\)/,
  );
});
