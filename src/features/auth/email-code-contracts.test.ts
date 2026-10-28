import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { hungryService } from "@/lib/services/mock/mockService";

const read = (file: string) => readFileSync(resolve(__dirname, "../../..", file), "utf8");

// Email links only work on the phone that asked for them, so sign-up, password reset
// and account deletion also accept the 8-digit code from the email.

test("the code length matches supabase auth.email.otp_length", () => {
  assert.match(read("supabase/config.toml"), /\[auth\.email\][\s\S]*?otp_length = 8/);
  assert.match(read("src/features/auth/EmailCodeField.tsx"), /EMAIL_CODE_LENGTH = 8;/);
});

test("every email the app asks a code for is a checked-in template with {{ .Token }}", () => {
  const config = read("supabase/config.toml");
  for (const template of ["confirmation", "recovery", "magic_link"]) {
    assert.match(
      config,
      new RegExp(
        `\\[auth\\.email\\.template\\.${template}\\]\\s*subject = "[^"]+"\\s*content_path = "\\./supabase/templates/${template}\\.html"`,
      ),
    );
    assert.match(read(`supabase/templates/${template}.html`), /\{\{ \.Token \}\}/);
  }
  // Account deletion uses the Magic Link email; it must not hold a sign-in link.
  assert.doesNotMatch(read("supabase/templates/magic_link.html"), /ConfirmationURL/);
  // Production sends through the Send Email Hook, so no SMTP block is pinned.
  assert.doesNotMatch(config, /\[auth\.email\.smtp\]/);
});

test("the password policy is pinned in config.toml to match the app", () => {
  const config = read("supabase/config.toml");
  assert.match(read("src/features/auth/validation.ts"), /MIN_PASSWORD_LENGTH = 10;/);
  assert.match(config, /\[auth\][\s\S]*?minimum_password_length = 10\n[\s\S]*?\[auth\.email\]/);
  assert.match(config, /\[auth\.email\][\s\S]*?secure_password_change = true/);
});

test("sign-up and reset check-your-email screens verify the emailed code", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  assert.match(
    service,
    /async verifyEmailCode\(email, code, type\) \{[\s\S]*?client\.auth\.verifyOtp\(\{\s*email: normalizeAuthEmail\(email\),\s*token: code\.trim\(\),\s*type,/,
  );

  const verify = read("src/app/screens/auth/EmailVerificationScreen.tsx");
  assert.match(verify, /<EmailCodeField onSubmit=\{confirmWithEmailCode\}/);
  assert.match(
    verify,
    /verifyEmailCode\(email, code, "signup"\)[\s\S]*?finishVerifiedSession\(session\)/,
  );

  const forgot = read("src/app/screens/auth/ForgotPasswordScreen.tsx");
  assert.match(forgot, /<EmailCodeField onSubmit=\{handleResetCode\}/);
  // Verifying signs the user in: hold RootNavigator's redirect before it, release on failure.
  assert.match(
    forgot,
    /setPasswordRecoveryInProgress\(true\);\s*try \{\s*await getHungryService\(\)\.auth\.verifyEmailCode\(sentTo, code, "recovery"\);\s*\} catch \(error\) \{\s*if \(!fromSignedIn\) setPasswordRecoveryInProgress\(false\);/,
  );
  assert.match(forgot, /navigate\("ResetPassword", \{\s*email: sentTo,\s*recoveryVerified: true,/);
  // Only a real boolean skips the link-code exchange; a deep link's "true" string does not.
  assert.match(
    read("src/app/screens/auth/ResetPasswordScreen.tsx"),
    /useRef\(route\.params\?\.recoveryVerified === true\)/,
  );
});

test("account deletion asks for an emailed code before the RPC", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  assert.match(
    service,
    /async sendAccountDeletionCode\(\) \{[\s\S]*?signInWithOtp\(\{\s*email,\s*options: \{ shouldCreateUser: false \},/,
  );
  assert.match(
    service,
    /async requestAccountDeletion\(request\) \{[\s\S]*?verifyOtp\(\{\s*email,\s*token: code,\s*type: "email",\s*\}\);\s*if \(codeError\) throw codeError;\s*if \(verified\.user\?\.id !== userId\)[\s\S]*?client\.rpc\("request_my_account_deletion"/,
  );

  const settings = read("src/app/screens/profile/SettingsScreen.tsx");
  assert.match(
    settings,
    /auth\.sendAccountDeletionCode\(\);\s*trackAnalyticsEvent\("account_deletion_code_sent"[^;]*;\s*setDeletionCodeVisible\(true\);/,
  );
  assert.match(
    settings,
    /requestAccountDeletion\(\{\s*reason: "user_initiated_settings_flow",\s*code,/,
  );
  assert.match(settings, /<AccountDeletionCodeDialog/);
});

test("mock verifyEmailCode accepts only an 8-digit code", async () => {
  await assert.rejects(() => hungryService.auth.verifyEmailCode("a@b.sg", "1234", "signup"));
  assert.ok(await hungryService.auth.verifyEmailCode("a@b.sg", "12345678", "signup"));
  assert.equal(await hungryService.auth.verifyEmailCode("a@b.sg", "12345678", "recovery"), null);
  await hungryService.auth.signOut();
});
