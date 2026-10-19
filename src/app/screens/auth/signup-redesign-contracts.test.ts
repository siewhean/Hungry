import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { AUTH_COPY } from "./authCopy";

const read = (relativePath: string) => readFileSync(path.join(process.cwd(), relativePath), "utf8");

test("onboarding completion opens the one canonical Create account screen", () => {
  const finish = read("src/app/screens/onboarding/finishLocationStep.ts");
  const stack = read("src/app/screens/onboarding/OnboardingStack.tsx");
  const types = read("src/app/navigation/navigationTypes.ts");

  assert.match(finish, /completeOnboarding\(hasSkippedTasteQuiz\)/);
  assert.match(finish, /resolveOnboardingExitRoute\(\{ isAuthenticated \}\)/);
  assert.match(finish, /rootNav\.reset\(/);
  assert.doesNotMatch(finish, /"Login"/);
  // The competing onboarding-only sign-up/sign-in tab screen is gone.
  assert.doesNotMatch(stack, /OnboardingAuth/);
  assert.doesNotMatch(types, /OnboardingAuth/);
  assert.equal(existsSync("src/app/screens/onboarding/OnboardingAuthScreen.tsx"), false);
  assert.equal(existsSync("src/app/screens/onboarding/MandatoryOnboardingAuthScreen.tsx"), false);
});

test("Create account and Login link to each other", () => {
  const signUp = read("src/app/screens/auth/SignUpScreen.tsx");
  const login = read("src/app/screens/auth/LoginScreen.tsx");

  assert.equal(AUTH_COPY.signUp.footerPrompt, "Already have an account? ");
  assert.equal(AUTH_COPY.signUp.footerAction, "Sign in");
  assert.match(signUp, /navigation\.navigate\("Login"\)/);
  assert.equal(AUTH_COPY.login.footerAction, "Create account");
  assert.match(login, /navigation\.navigate\("SignUp"\)/);
  // Whole prompt row is the 44pt target on both screens.
  for (const source of [signUp, login]) {
    assert.match(source, /minHeight: componentSizes\.touchTarget/);
  }
});

test("Create account has clear hierarchy, labelled autofill fields and a pinned primary action", () => {
  const signUp = read("src/app/screens/auth/SignUpScreen.tsx");

  assert.equal(AUTH_COPY.signUp.title, "Create your account");
  // No description under the title.
  assert.equal("subtitle" in AUTH_COPY.signUp, false);
  assert.match(signUp, /layout="balanced"/);
  assert.match(signUp, /title=\{AUTH_COPY\.signUp\.title\}/);
  assert.doesNotMatch(signUp, /subtitle=/);

  assert.equal(AUTH_COPY.signUp.displayNamePlaceholder, "Full Name");
  assert.equal(AUTH_COPY.signUp.emailPlaceholder, "Email Address");
  assert.match(signUp, /placeholder=\{AUTH_COPY\.signUp\.displayNamePlaceholder\}/);
  assert.match(signUp, /placeholder=\{AUTH_COPY\.signUp\.emailPlaceholder\}/);

  // Placeholder-only fields: no visible labels, placeholder doubles as the accessible name.
  assert.equal(AUTH_COPY.signUp.passwordPlaceholder, "Password");
  assert.doesNotMatch(signUp, /\slabel=\{AUTH_COPY\.signUp\.(displayName|email|password)/);
  assert.match(
    signUp,
    /accessibilityLabel=\{AUTH_COPY\.signUp\.displayNamePlaceholder\}[\s\S]*textContentType="name"/,
  );
  assert.match(
    signUp,
    /accessibilityLabel=\{AUTH_COPY\.signUp\.emailPlaceholder\}[\s\S]*textContentType="emailAddress"/,
  );
  assert.match(
    signUp,
    /accessibilityLabel=\{AUTH_COPY\.signUp\.passwordPlaceholder\}[\s\S]*autoComplete="new-password"[\s\S]*textContentType="newPassword"/,
  );
  assert.match(signUp, /accessibilityLabel=\{showPassword \? "Hide password" : "Show password"\}/);
  // Requirements stay hidden until the password field is focused or has content.
  assert.match(signUp, /onFocus=\{\(\) => setIsPasswordFocused\(true\)\}/);
  assert.match(signUp, /setIsPasswordFocused\(false\);\s*onBlur\(\);/);
  assert.match(
    signUp,
    /<PasswordRequirements password=\{value\} revealed=\{isPasswordFocused\} \/>/,
  );

  // Consent, primary action and the Sign in link live in the sticky footer.
  assert.match(
    signUp,
    /stickyAction=\{[\s\S]*testID="signup-terms-consent"[\s\S]*label=\{AUTH_COPY\.signUp\.primaryButton\}[\s\S]*accessibilityLabel=\{AUTH_COPY\.signUp\.footerAction\}[\s\S]*\}\s*>/,
  );
  assert.match(signUp, /openTrustedExternalUrl\(WEB_LINKS\.terms\)/);
  assert.match(signUp, /openTrustedExternalUrl\(WEB_LINKS\.privacy\)/);
  assert.equal((signUp.match(/accessibilityRole="link"/g) ?? []).length, 2);

  // Inline validation matches Login: react-hook-form rules + Input error text.
  assert.match(signUp, /error=\{!!errors\.email\}\s*errorText=\{errors\.email\?\.message\}/);
  assert.match(signUp, /validate: \(value\) => validatePassword\(value\)/);
});

test("login keeps its form with placeholder-only fields and autofill", () => {
  const login = read("src/app/screens/auth/LoginScreen.tsx");
  assert.equal(AUTH_COPY.login.emailPlaceholder, "Email Address");
  assert.equal(AUTH_COPY.login.passwordPlaceholder, "Password");
  assert.doesNotMatch(login, /\slabel=\{AUTH_COPY\.login\.(email|password)/);
  assert.match(login, /accessibilityLabel=\{AUTH_COPY\.login\.emailPlaceholder\}/);
  assert.match(login, /accessibilityLabel=\{AUTH_COPY\.login\.passwordPlaceholder\}/);
  assert.match(login, /autoComplete="current-password"/);
  assert.match(login, /textContentType="password"/);
  // No description under the title, matching Create account.
  assert.equal("subtitle" in AUTH_COPY.login, false);
  assert.doesNotMatch(login, /subtitle=/);
});

test("password requirements are compact, hidden until needed and collapse when all are met", () => {
  const checklist = read("src/app/screens/auth/PasswordRequirements.tsx");
  const reset = read("src/app/screens/auth/ResetPasswordScreen.tsx");

  assert.match(checklist, /getPasswordRuleStatuses\(value\)/);
  assert.match(checklist, /if \(!revealed && value\.length === 0\) return null;/);
  // Small type, two-column wrap, no tinted panel.
  assert.match(checklist, /variant="micro"/);
  assert.match(checklist, /flexWrap: "wrap"/);
  assert.match(checklist, /flexBasis: "45%"/);
  assert.doesNotMatch(checklist, /backgroundColor/);
  assert.doesNotMatch(checklist, /variant="bodySmall"/);
  // One subtle line once every rule is met.
  assert.match(checklist, /if \(allMet\)[\s\S]*Strong password/);
  // Screen-reader summary, not colour alone.
  assert.match(checklist, /\$\{metCount\} of \$\{statuses\.length\} requirements met/);
  assert.match(checklist, /accessibilityLabel=\{`Password requirements: \$\{summary\}/);
  assert.match(checklist, /status\.met \? "met" : "not met"/);

  // Reset password shares the compact component, without the old raised panel.
  assert.match(
    reset,
    /<PasswordRequirements password=\{passwordValue \?\? ""\} revealed=\{isPasswordFocused\} \/>/,
  );
  assert.doesNotMatch(reset, /surfaceRaised/);
});

test("shared Input shows a neutral (not brand orange) focus border and suppresses the web outline", () => {
  const input = read("src/components/ui/Input.tsx");

  assert.match(input, /isFocused\s*\?\s*\(focusBorderColor \?\? palette\.textSecondary\)/);
  assert.match(input, /error\s*\?\s*palette\.error/);
  assert.doesNotMatch(input, /palette\.(orange|orangeControl|orangeText|accentText)/);
  assert.match(input, /const FOCUSED_BORDER_WIDTH = 2;/);
  assert.match(input, /outlineStyle: "none"/);
  // Caller focus handlers still fire.
  assert.match(input, /setIsFocused\(true\);\s*onFocus\?\.\(event\);/);
  assert.match(input, /setIsFocused\(false\);\s*onBlur\?\.\(event\);/);
});

test("Login and Create account share one brand header and the balanced vertical layout", () => {
  const shell = read("src/app/screens/auth/AuthScreenShell.tsx");
  const header = read("src/app/screens/auth/AuthBrandHeader.tsx");
  const signUp = read("src/app/screens/auth/SignUpScreen.tsx");
  const login = read("src/app/screens/auth/LoginScreen.tsx");

  // Same lockup, size, top spacing and logo-to-title gap, defined once.
  assert.match(header, /export const AUTH_BRAND_LOGO_SIZE = 96;/);
  assert.match(header, /<HungryLogo\s+size=\{AUTH_BRAND_LOGO_SIZE\}/);
  assert.match(header, /gap: spacing\[4\], paddingTop: spacing\[6\]/);
  for (const source of [signUp, login]) {
    assert.match(source, /layout="balanced"/);
    assert.doesNotMatch(source, /brand=|contentOffsetTop=|wordmarkColor=/);
  }

  // Balanced layout: fixed header, form centred by equal flex spacers (no magic offset),
  // still inside the keyboard-revealing ScrollView so short screens scroll.
  assert.match(
    shell,
    /isBalanced \? \([\s\S]*onFocus=\{keyboardReveal\.onFocus\}[\s\S]*<AuthBrandHeader title=\{title\} subtitle=\{subtitle\} \/>[\s\S]*flexGrow: 1, minHeight: spacing\[6\][\s\S]*\{children\}[\s\S]*flexGrow: 1, minHeight: spacing\[3\]/,
  );
  assert.match(shell, /contentContainerStyle=\{\{\s*flexGrow: 1,/);
});
