import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("both account creation paths gate email and provider requests with unchecked adult and terms confirmations", () => {
  for (const file of [
    "src/app/screens/auth/SignUpScreen.tsx",
    "src/app/screens/auth/LoginScreen.tsx",
    "src/app/screens/onboarding/OnboardingAuthScreen.tsx",
  ]) {
    const source = read(file);
    assert.match(source, /\[adultConfirmed, setAdultConfirmed\] = useState\(false\)/);
    assert.match(source, /\[termsAccepted, setTermsAccepted\] = useState\(false\)/);
    const email = source.slice(
      source.indexOf("const handleSignUp ="),
      source.indexOf("const handleSignUp =") + 600,
    );
    if (!file.endsWith("/LoginScreen.tsx"))
      assert.ok(email.indexOf("hasRegistrationConsent(") < email.indexOf(".auth.signUp("));
    const provider = source.slice(
      source.indexOf("const handleProvider"),
      source.indexOf("const handleProvider") + 800,
    );
    assert.ok(provider.indexOf("hasRegistrationConsent(") >= 0);
    assert.ok(provider.indexOf("hasRegistrationConsent(") < provider.indexOf("signInWithGoogle("));
    assert.match(source, /<RegistrationConsent/);
  }
});

test("confirmations expose checkbox semantics and do not request a date of birth", () => {
  const control = read("src/app/screens/auth/RegistrationConsent.tsx");
  assert.match(control, /accessibilityRole="checkbox"/);
  assert.match(control, /accessibilityState=\{\{ checked \}\}/);
  assert.match(control, /I am 18 or older/);
  assert.doesNotMatch(control, /TextInput|DateTimePicker/);
  const settings = read("src/app/screens/profile/SettingsScreen.tsx");
  for (const policy of ["refunds", "cookies", "credits", "accountDeletion"]) {
    assert.ok(settings.includes(`WEB_LINKS.${policy}`));
  }
});
