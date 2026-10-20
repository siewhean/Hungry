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
    /setPasswordRecoveryInProgress\(true\);\s*try \{\s*await getHungryService\(\)\.auth\.verifyEmailCode\(sentTo, code, "recovery"\);\s*\} catch \(error\) \{\s*setPasswordRecoveryInProgress\(false\);/,
  );
  assert.match(forgot, /navigate\("ResetPassword", \{ email: sentTo, recoveryVerified: true \}\)/);
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
  assert.match(settings, /auth\.sendAccountDeletionCode\(\);\s*setDeletionCodeVisible\(true\);/);
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
