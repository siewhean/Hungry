import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { AUTH_COPY } from "./authCopy";
import { getAuthErrorLogContext, getLoginErrorMessage } from "./authErrors";

const read = (relativePath: string) => readFileSync(path.join(process.cwd(), relativePath), "utf8");

test("auth shell keeps forms above the keyboard and dismisses on background tap", () => {
  const shell = read("src/app/screens/auth/AuthScreenShell.tsx");
  assert.match(shell, /<KeyboardAvoidingView/);
  assert.match(shell, /behavior=\{Platform\.OS === "ios" \? "padding" : undefined\}/);
  assert.match(shell, /keyboardShouldPersistTaps="handled"/);
  const onboardingAuth = read("src/app/screens/onboarding/OnboardingAuthScreen.tsx");
  assert.match(onboardingAuth, /<KeyboardAvoidingView/);
  assert.match(onboardingAuth, /keyboardShouldPersistTaps="handled"/);
});

test("primary buttons use one theme text colour (no white override)", () => {
  const button = read("src/components/ui/Button.tsx");
  assert.match(button, /variant === "primary"\s*\? palette\.textOnOrange/);
  assert.match(button, /<ActivityIndicator[\s\S]*variant === "primary"\s*\? palette\.textOnOrange/);
  for (const file of [
    "src/app/screens/auth/LoginScreen.tsx",
    "src/app/screens/auth/SignUpScreen.tsx",
    "src/app/screens/onboarding/OnboardingAuthScreen.tsx",
  ]) {
    assert.doesNotMatch(read(file), /labelColor=\{palette\.white\}/, file);
  }
});

test("sign-up fields use Input error styling and the visible field name", () => {
  for (const file of [
    "src/app/screens/auth/SignUpScreen.tsx",
    "src/app/screens/onboarding/OnboardingAuthScreen.tsx",
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /style=\{\{ color: palette\.error \}\}/, file);
    assert.match(source, /error=\{!!\w+\.email\}\s*errorText=\{\w+\.email\?\.message\}/, file);
  }
  assert.equal(AUTH_COPY.signUp.displayNamePlaceholder, "Full name");
  assert.equal(AUTH_COPY.signUp.displayNameValidationLabel, "Full name");
});

test("login errors map to clear messages and log without PII", () => {
  assert.equal(
    getLoginErrorMessage({ code: "invalid_credentials" }),
    AUTH_COPY.login.invalidCredentialsToast,
  );
  assert.equal(
    getLoginErrorMessage({ error_code: "email_not_confirmed" }),
    AUTH_COPY.login.emailNotConfirmedToast,
  );
  assert.equal(getLoginErrorMessage({ status: 429 }), AUTH_COPY.login.tooManyAttemptsToast);
  assert.equal(
    getLoginErrorMessage(new TypeError("Network request failed")),
    AUTH_COPY.login.networkErrorToast,
  );
  assert.equal(getLoginErrorMessage(new Error("boom")), AUTH_COPY.login.genericErrorToast);
  assert.equal(getLoginErrorMessage(undefined), AUTH_COPY.login.genericErrorToast);

  const context = getAuthErrorLogContext({
    code: "invalid_credentials",
    status: 400,
    name: "AuthApiError",
    message: "user@example.com is invalid",
    email: "user@example.com",
  });
  assert.deepEqual(context, { code: "invalid_credentials", status: 400, name: "AuthApiError" });

  const login = read("src/app/screens/auth/LoginScreen.tsx");
  assert.match(
    login,
    /console\.warn\("\[auth\] Email sign-in failed", getAuthErrorLogContext\(err\)\)/,
  );
  assert.match(login, /showToast\(\{ message: getLoginErrorMessage\(err\), tone: "error" \}\)/);
});
