import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  PROFILE_DISPLAY_NAME_MAX_LENGTH,
  isCheckViolation,
  isReservedDisplayName,
  profileTextRefusalHint,
  validateDisplayName,
} from "@/features/profile/profileName";
import {
  ANDROID_TEXT_SHARE_LIMIT_CHARS,
  canShareExportAsText,
} from "@/features/profile/exportFile";
import { hungryService } from "@/lib/services/mock/mockService";

function read(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const settings = () => read("src/app/screens/profile/SettingsScreen.tsx");
const service = () => read("src/lib/services/supabase/supabaseService.ts");

// --- Display names (M10) -----------------------------------------------------------------

test("display names: 40-character cap and reserved names mirror the server guard", () => {
  assert.equal(PROFILE_DISPLAY_NAME_MAX_LENGTH, 40);
  for (const reserved of [
    "Hungry",
    "  H u n g r y  Team ",
    "Adm1n",
    "HUNGRY_official",
    "support",
  ]) {
    assert.equal(isReservedDisplayName(reserved), true, reserved);
  }
  for (const fine of ["Hungry Hippo", "Appetite", "Mei Ling", "Hungry Appetite"]) {
    assert.equal(isReservedDisplayName(fine), false, fine);
  }
  assert.equal(validateDisplayName("   "), "Enter a display name.");
  assert.match(validateDisplayName("x".repeat(41)) ?? "", /40 characters or fewer/);
  assert.match(validateDisplayName("Hungry Team") ?? "", /reserved/);
  assert.equal(validateDisplayName("Mei Ling"), undefined);
  assert.equal(isCheckViolation({ code: "23514" }), true);
  assert.equal(
    profileTextRefusalHint({ code: "23514", hint: "display_name_reserved" }),
    "display_name_reserved",
  );
  assert.equal(profileTextRefusalHint({ code: "23505", hint: "x" }), undefined);
});

test("edit profile caps the name, maps server refusals, and can remove the photo", () => {
  const edit = read("src/app/screens/profile/EditProfileScreen.tsx");
  assert.match(edit, /maxLength=\{PROFILE_DISPLAY_NAME_MAX_LENGTH\}/);
  assert.match(edit, /profileTextRefusalHint\(error\)/);
  assert.match(edit, /display_name_reserved/);
  assert.match(edit, /accessibilityLabel="Remove profile photo"/);
  assert.match(
    edit,
    /removeAvatar \? \{ avatarUrl: "" \} : avatarUri \? \{ avatarUrl: avatarUri \} : \{\}/,
  );
  assert.match(edit, /getPendingEmailChange\(\)/);
  assert.match(edit, /Waiting for confirmation: \{pendingEmail\}/);
  // Password now lives under Settings > Sign-in and security.
  assert.doesNotMatch(edit, /Change Password/);
  const supabase = service();
  assert.match(supabase, /updates\.avatarUrl === ""\s*\? null/);
  assert.match(supabase, /AVATAR_UPLOAD_MAX_EDGE_PX = 512/);
  assert.match(supabase, /maxEdgePx: AVATAR_UPLOAD_MAX_EDGE_PX/);
  assert.match(
    read("src/lib/services/supabase/mediaUpload.ts"),
    /maxEdgePx: number = MAX_UPLOAD_IMAGE_EDGE_PX/,
  );
  // A provider name the server refuses must not break sign-in.
  assert.match(supabase, /isCheckViolation\(error\)/);
  assert.match(supabase, /providerDisplayName\.slice\(0, PROFILE_DISPLAY_NAME_MAX_LENGTH\)/);
});

test("mock profile service mirrors the name guard, avatar removal and pending email", async () => {
  const before = await hungryService.profile.getProfile();
  await hungryService.auth.signIn("tester@example.com", "correct horse battery");
  try {
    await assert.rejects(() => hungryService.profile.updateProfile({ displayName: "Hungry Team" }));
    await assert.rejects(() =>
      hungryService.profile.updateProfile({ displayName: "n".repeat(41) }),
    );
    const named = await hungryService.profile.updateProfile({
      displayName: "  Mei Ling ",
      avatarUrl: "file:///tmp/a.jpg",
    });
    assert.equal(named.displayName, "Mei Ling");
    assert.equal(named.avatarUrl, "file:///tmp/a.jpg");
    const removed = await hungryService.profile.updateProfile({ avatarUrl: "" });
    assert.equal(removed.avatarUrl, undefined);

    assert.equal(await hungryService.auth.getPendingEmailChange(), null);
    await hungryService.auth.requestEmailChange("New@Example.com");
    assert.equal(await hungryService.auth.getPendingEmailChange(), "new@example.com");
  } finally {
    await hungryService.profile.updateProfile({ displayName: before.displayName });
    await hungryService.auth.signOut();
  }
});

// --- Sessions (M3, M4) -------------------------------------------------------------------

test("plain sign-out only ends this device; global is explicit (M4)", () => {
  const supabase = service();
  assert.match(supabase, /const scope = options\?\.scope \?\? "local";/);
  assert.match(supabase, /client\.auth\.signOut\(\{ scope \}\)/);
  assert.match(supabase, /if \(scope !== "local"\) throw error;/);
  // The session store calls signOut() with no scope, which is local.
  assert.match(
    read("src/store/useSessionStore.ts"),
    /\.then\(\(\) => service\.auth\.signOut\(\)\)/,
  );
  assert.match(
    read("src/lib/services/types.ts"),
    /signOut\(options\?: \{ scope\?: AuthSignOutScope \}\)/,
  );
  assert.match(settings(), /"You will be signed out from Hungry on this device\."/);
});

test("Settings can sign out of every device, and a password change offers it (M3)", () => {
  const screen = settings();
  assert.match(screen, /label="Sign out of all devices"/);
  assert.match(screen, /signOut\(\{ scope: "global" \}\)/);
  const change = read("src/app/screens/profile/ChangePasswordScreen.tsx");
  assert.match(change, /signOut\(\{ scope: "others" \}\)/);
  assert.match(change, /Sign out other devices/);
});

test("Sign-in and security groups email and password in Settings (L3)", () => {
  const screen = settings();
  assert.match(screen, /title="Sign-in and security"/);
  assert.match(screen, /label="Change password"/);
  assert.match(screen, /rootNavigation\.navigate\("ChangePassword"\)/);
  assert.match(screen, /description="Change it in Edit profile\."/);
});

test("change password has autofill hints, a reveal toggle and a forgot link (L10)", () => {
  const change = read("src/app/screens/profile/ChangePasswordScreen.tsx");
  assert.match(change, /textContentType="password"/);
  assert.match(change, /autoComplete="current-password"/);
  assert.equal(change.match(/textContentType="newPassword"/g)?.length, 2);
  assert.equal(change.match(/autoComplete="new-password"/g)?.length, 2);
  assert.match(change, /"Show passwords"/);
  assert.match(change, /Forgot current password\?/);
  assert.match(change, /screen: "ForgotPassword"/);
});

// --- Guests (M8, L15) --------------------------------------------------------------------

test("guests can open Settings and see only guest-safe rows (M8, L15)", () => {
  const root = read("src/app/navigation/RootNavigator.tsx");
  const protectedBlock = root.slice(
    root.indexOf("const PROTECTED_ROOT_ROUTES"),
    root.indexOf("]);", root.indexOf("const PROTECTED_ROOT_ROUTES")),
  );
  assert.doesNotMatch(protectedBlock, /"Settings"/);
  assert.match(protectedBlock, /"BlockedAndHidden"/);
  const linking = read("src/app/navigation/linking.ts");
  assert.doesNotMatch(
    linking.slice(linking.indexOf("PROTECTED_DEEP_LINK_ROUTES"), linking.indexOf("]);")),
    /"Settings"/,
  );

  const screen = settings();
  assert.match(screen, /\{isAuthenticated \? \(\s*<PendingDeletionBanner/);
  // The app is sign-in only (PreAuthNavigator), so the guest sign-in row is gone.
  assert.doesNotMatch(screen, /label="Sign in or create an account"/);
  // Account-only rows sit inside isAuthenticated branches.
  for (const accountOnly of [
    'label="Profile visibility"',
    "label={BLOCKED_AND_HIDDEN_TITLE}",
    "label={isExportingData",
    'label="Delete account"',
  ]) {
    const index = screen.indexOf(accountOnly);
    assert.ok(index > 0, accountOnly);
    assert.match(screen.slice(Math.max(0, index - 700), index), /isAuthenticated \?/, accountOnly);
  }
  // Theme, accessibility, location and the legal links stay open to guests.
  assert.doesNotMatch(
    screen.slice(
      screen.indexOf('title="Accessibility and display"') - 200,
      screen.indexOf('title="Support"'),
    ),
    /isAuthenticated/,
  );
});

// --- Account deletion (M1 client, M2, L4, L5) --------------------------------------------

test("deletion dialog says the profile is hidden, resends codes and is destructive (L4)", () => {
  const screen = settings();
  assert.match(screen, /Your profile is hidden straight away/);
  const dialog = read("src/components/settings/AccountDeletionCodeDialog.tsx");
  assert.match(dialog, /onResend=\{onResend\}/);
  assert.match(dialog, /submitVariant="destructive"/);
  const field = read("src/features/auth/EmailCodeField.tsx");
  assert.match(field, /EMAIL_CODE_RESEND_SECONDS = 60/);
  assert.match(field, /Resend code in \$\{cooldown\}s/);
  assert.match(field, /variant=\{submitVariant\}/);
  assert.match(screen, /onResend=\{resendDeletionCode\}/);
});

test("a no-email account and a merchant owner each get their own message (L5, M2)", () => {
  const screen = settings();
  assert.match(screen, /isNoAccountEmailError\(error\)/);
  assert.match(screen, /has no email address, so we can't send a code/);
  assert.match(screen, /getAccountDeletionBlocker\(\)/);
  assert.match(screen, /Transfer your business first/);
  assert.match(service(), /rpc\("get_my_account_deletion_blocker"\)/);
  const sql = read(
    "supabase/migrations/20261022100000_account_deactivation_on_deletion_request.sql",
  );
  assert.match(sql, /raise exception 'merchant_owner_must_transfer'/);
  assert.match(sql, /merchant_accounts ma where ma\.user_id = p_user_id/);
});

test("the two deletion-date formats are one (L12)", () => {
  const screen = settings();
  assert.match(
    screen,
    /import \{ formatDeletionDate \} from "@\/features\/auth\/useAccountDeletionGracePrompt"/,
  );
  assert.doesNotMatch(screen, /toLocaleDateString/);
});

// --- Export (M7, L6) ---------------------------------------------------------------------

test("a large Android export is not pushed through the share sheet (M7)", () => {
  assert.equal(canShareExportAsText("x".repeat(ANDROID_TEXT_SHARE_LIMIT_CHARS)), true);
  assert.equal(canShareExportAsText("x".repeat(ANDROID_TEXT_SHARE_LIMIT_CHARS + 1)), false);
  const screen = settings();
  assert.match(screen, /canShareExportAsText\(exportJson\)/);
  assert.match(screen, /Your export is large/);
  assert.match(screen, /JSON\.stringify\(exportData\);/);
});

test("the export file is removed after sharing, on sign-out, deletion and cache clear (L6)", () => {
  const screen = settings();
  assert.equal(screen.match(/deleteExportFile\(\);/g)?.length, 3);
  const store = read("src/store/useSessionStore.ts");
  assert.match(store, /import \{ deleteExportFile \} from "@\/features\/profile\/exportFile";/);
  assert.match(
    store,
    /function clearAccountLocalHistory\(\): void \{[\s\S]*?deleteExportFile\(\);/,
  );
});

test("the export function lists the missing user data stores (M6)", () => {
  const sql = read("supabase/migrations/20261022100100_export_my_data_more_stores.sql");
  for (const table of [
    "review_helpful_votes",
    "portfolio_items",
    "portfolio_collaborators",
    "portfolio_follows",
    "recommendation_impressions",
    "passport_progress_events",
    "user_stall_interactions",
    "user_mission_progress",
  ]) {
    assert.match(sql, new RegExp(`public\\.${table}\\b`), table);
  }
  // jsonb_build_object takes at most 100 arguments (50 categories).
  const pairs = sql.match(/^ {4}'[A-Za-z]+',$/gm)?.length ?? 0;
  assert.ok(pairs <= 50, `v_data has ${pairs} categories`);
  assert.match(sql, /'notIncluded', jsonb_build_array\(/);
  assert.ok(existsSync(path.join(process.cwd(), "supabase/smoke/export_my_data_more_stores.sql")));
});

// --- Deactivation (M1) -------------------------------------------------------------------

test("a pending deletion request deactivates the account for other viewers (M1)", () => {
  const sql = read(
    "supabase/migrations/20261022100000_account_deactivation_on_deletion_request.sql",
  );
  assert.match(sql, /function app_private\.account_is_deactivated\(p_user_id uuid\)/);
  assert.match(sql, /adr\.status in \('requested', 'processing'\)/);
  for (const fn of [
    "app_private.can_read_author_content(p_author_id uuid)",
    "app_private.can_read_review(",
    "public.get_public_portfolio(p_portfolio_id uuid)",
    "app_private.search_portfolios(",
  ]) {
    assert.ok(sql.includes(fn), fn);
  }
  assert.match(sql, /not app_private\.account_is_deactivated\(p_author_id\)/);
  assert.match(sql, /portfolios_select_hide_deactivated/);
  assert.ok(
    existsSync(
      path.join(process.cwd(), "supabase/smoke/account_deactivation_on_deletion_request.sql"),
    ),
  );
});

// --- Name and bio filter (M10) -----------------------------------------------------------

test("profile names and bios get a server length cap, reserved check and text filter (M10)", () => {
  const sql = read("supabase/migrations/20261022100200_profile_text_guards.sql");
  assert.match(sql, /user_profiles_display_name_length/);
  assert.match(sql, /char_length\(display_name\) <= 40/);
  assert.match(sql, /app_private\.is_reserved_display_name/);
  assert.match(sql, /app_private\.review_text_violation\(/);
  assert.match(sql, /current_user not in \('anon', 'authenticated'\)/);
  assert.ok(existsSync(path.join(process.cwd(), "supabase/smoke/profile_text_guards.sql")));
});

// --- Notifications (M9) ------------------------------------------------------------------

test("notification switches show the saved value, dimmed, while the OS blocks notifications (M9, SET-16)", () => {
  const alerts = read("src/components/settings/StallAlertsSettings.tsx");
  assert.match(alerts, /getNotificationPermissionState\(\)/);
  assert.match(alerts, /AppState\.addEventListener\("change"/);
  assert.match(alerts, /Notifications are off for Hungry/);
  // A saved alert stays visible so it can be turned off; the "off" row explains the block.
  assert.doesNotMatch(alerts, /&& !permissionDenied/);
  assert.equal(alerts.match(/dimmed=\{permissionDenied\}/g)?.length, 4);
  assert.match(read("src/lib/notifications/push.ts"), /getPermissionsAsync\(\)/);
});

// --- Copy, labels, touch targets, links (L1, L2, L7, L8, L9, L11, L17) -------------------

test("left-handed mode no longer right-aligns post text (L1)", () => {
  const home = read("src/app/screens/home/HomeFeedScreen.tsx");
  assert.doesNotMatch(home, /textAlign: leftHandedMode/);
  assert.doesNotMatch(home, /alignSelf: leftHandedMode/);
  // Posts are archived; the row now names the only floating button it moves.
  assert.doesNotMatch(settings(), /like and save buttons on posts/);
  assert.match(settings(), /Moves the add button on your merchant menu to the left side\./);
});

test("reset food history copy matches what it clears (L2)", () => {
  assert.match(settings(), /Your taste profile, favourites and reviews stay\./);
});

test("theme and visibility use radio sheets, not Alert buttons or a check glyph (L7)", () => {
  const screen = settings();
  assert.match(screen, /<SettingsChoiceSheet[\s\S]*title="Theme"/);
  assert.match(screen, /<SettingsChoiceSheet[\s\S]*title="Profile visibility"/);
  assert.doesNotMatch(screen, /✓/);
  const sheet = read("src/components/settings/SettingsChoiceSheet.tsx");
  assert.match(sheet, /accessibilityRole="radio"/);
  assert.match(sheet, /accessibilityState=\{\{ selected: isSelected, checked: isSelected \}\}/);
  assert.match(sheet, /accessibilityRole="radiogroup"/);
});

test("web-opening rows are links with an external icon and hint (L8)", () => {
  const row = read("src/components/settings/SettingsRow.tsx");
  assert.match(row, /ExternalLink/);
  assert.match(row, /"Opens in browser"/);
  const screen = settings();
  for (const label of [
    "Contact us",
    "Privacy policy",
    "Terms of service",
    "How account deletion works",
  ]) {
    const index = screen.indexOf(`label="${label}"`);
    assert.ok(index > 0, label);
    assert.match(screen.slice(index, index + 200), /type="link"/, label);
  }
});

test("secondary controls meet 44pt and labels are consistent (L9, L11)", () => {
  const picker = read("src/app/screens/onboarding/ManualLocationPickerScreen.tsx");
  assert.match(picker, /height: 44,[\s\S]{0,80}width: 44,/);
  // Tapping a result saves it: there is no separate Save button.
  assert.doesNotMatch(picker, /"Save location"/);
  const screen = settings();
  assert.match(screen, /locationPermission === "granted" \? "Use GPS" : "Not set"/);
  assert.match(screen, /label="Change password"/);
});

test("the Version row carries the native build and update id and copies on long press (L17)", () => {
  const screen = settings();
  assert.match(screen, /Constants\.nativeBuildVersion/);
  assert.match(screen, /Updates\.updateId\?\.slice\(0, 8\)/);
  assert.match(screen, /onLongPress=\{handleCopyVersion\}/);
  assert.match(screen, /Clipboard\.setStringAsync/);
});

// --- Config (L16) ------------------------------------------------------------------------

test("TOTP enrolment and verification are off until merchant two-factor exists (L16)", () => {
  const config = read("supabase/config.toml");
  const totp = config.slice(config.indexOf("[auth.mfa.totp]"));
  assert.match(totp, /enroll_enabled = false/);
  assert.match(totp, /verify_enabled = false/);
});
