import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function read(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function segmentBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  if (startIndex < 0) return "";
  const endIndex = source.indexOf(end, startIndex + start.length);
  return source.slice(startIndex, endIndex < 0 ? undefined : endIndex);
}

test("Clear local cache removes only caches and keeps the session, profile and location", () => {
  const settings = read("src/app/screens/profile/SettingsScreen.tsx");
  const clearCache = segmentBetween(settings, "const handleClearLocalData", "const handleSignOut");

  assert.ok(clearCache);
  assert.match(clearCache, /"Clear local cache"/);
  assert.match(clearCache, /removeItem\("hungry-search-v1"\)/);
  assert.match(clearCache, /removeItem\("hungry-review-draft-v1"\)/);
  assert.match(clearCache, /clearImageCache\(\)/);
  assert.doesNotMatch(clearCache, /purgePersistedAccountData|hungry-session-v1|hungry-location-v1/);
  assert.match(settings, /label="Clear local cache"/);
});

test("Settings location rows respect the OS permission and return from the picker", () => {
  const settings = read("src/app/screens/profile/SettingsScreen.tsx");
  const picker = read("src/app/screens/onboarding/ManualLocationPickerScreen.tsx");

  assert.match(settings, /params: \{ mode: "settings" \}/);
  assert.match(settings, /AppState\.addEventListener\("change"/);
  assert.match(settings, /syncLocationPermission\(\)/);
  const store = read("src/store/useLocationStore.ts");
  // An OS that never asked must offer the prompt, not "Not allowed".
  assert.match(store, /status === "undetermined"[\s\S]{0,200}permission: "unknown"/);
  assert.match(settings, /clearManualLocation\(\)/);
  assert.doesNotMatch(settings, /denyLocation\(\)/);
  assert.doesNotMatch(settings, /label="Location permission"[\s\S]{0,120}type="toggle"/);

  const submit = segmentBetween(picker, "const handleSubmit", "return (");
  assert.ok(
    submit.indexOf("navigation.goBack()") < submit.indexOf("completeOnboarding("),
    "settings mode must go back before the onboarding completion path",
  );
  assert.match(submit, /if \(isSettingsMode\)/);
});

test("Email edits go through the auth email-change flow, not the profile column", () => {
  const editProfile = read("src/app/screens/profile/EditProfileScreen.tsx");
  const supabase = read("src/lib/services/supabase/supabaseService.ts");
  const updateProfile = segmentBetween(
    supabase,
    "async updateProfile(updates)",
    "async exportMyData",
  );

  assert.match(editProfile, /validateEmail\(nextEmail\)/);
  assert.match(editProfile, /auth\.requestEmailChange\(nextEmail\)/);
  assert.doesNotMatch(editProfile, /updateProfile\(\{[^}]*\bemail,/);
  assert.ok(updateProfile);
  assert.doesNotMatch(updateProfile, /payload\.email/);
  assert.match(
    supabase,
    /auth\.updateUser\(\s*\{ email: newEmail\.trim\(\)\.toLowerCase\(\) \},\s*\{ emailRedirectTo: AUTH_REDIRECTS\.emailConfirm \},?\s*\)/,
  );
  assert.match(editProfile, /current and new addresses/);
  assert.match(
    supabase,
    /email \?\? \(await getSessionEmailForUser\(client, userId\)\) \?\? asString\(row\.email\)/,
  );
});

test("SettingsRow exposes role, state and label to assistive tech", () => {
  const row = read("src/components/settings/SettingsRow.tsx");

  assert.match(row, /accessibilityRole=\{isToggle \? "switch" : "button"\}/);
  assert.match(row, /checked: Boolean\(isEnabled\), busy/);
  assert.match(row, /accessibilityValue=/);
  assert.match(row, /importantForAccessibility="no-hide-descendants"/);
  // Value-only rows are not pressable buttons.
  assert.match(row, /if \(!isInteractive\) \{\s*return \(\s*<View/);
  assert.match(read("src/app/screens/profile/SettingsScreen.tsx"), /busy=\{isExportingData\}/);
});

test("iOS data export is shared as a .json file, not a text message", () => {
  const settings = read("src/app/screens/profile/SettingsScreen.tsx");
  const exportHandler = segmentBetween(
    settings,
    "const handleExportData",
    "const handleDeleteAccount",
  );

  assert.match(exportHandler, /new File\(Paths\.cache, "hungry-data-export\.json"\)/);
  assert.match(
    exportHandler,
    /Share\.share\(\{ title: "My Hungry data", url: exportFile\.uri \}\)/,
  );
  assert.match(read("package.json"), /"expo-file-system": "~55\.0\.26"/);
});
