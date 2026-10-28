// R4 X3/X6: a two-button confirm on a profile screen goes through confirmAction (Alert.alert does
// nothing on web, so a confirm behind it makes the button a no-op there). Screens not yet swept
// are listed; the list may only shrink.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const dir = path.join(process.cwd(), "src/app/screens/profile");

/** Screens that still call Alert.alert; remove a file here when it is swept. */
const NOT_YET_SWEPT = new Set(["ChangePasswordScreen.tsx"]);

const screens = readdirSync(dir).filter(
  (file) => file.endsWith(".tsx") && !file.includes(".test."),
);

test("profile screens do not add new Alert.alert confirms", () => {
  const offenders = screens.filter(
    (file) =>
      !NOT_YET_SWEPT.has(file) &&
      /\bAlert\.alert\(/.test(
        readFileSync(path.join(dir, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, ""),
      ),
  );
  assert.deepEqual(offenders, [], "use confirmAction or a toast");
});

test("the not-yet-swept list only holds files that still use Alert.alert", () => {
  for (const file of NOT_YET_SWEPT) {
    assert.match(readFileSync(path.join(dir, file), "utf8"), /\bAlert\.alert\(/, file);
  }
});

test("the swept screens use confirmAction for their discard, remove, reset and sign-out asks", () => {
  const expectations: Record<string, RegExp[]> = {
    "EditProfileScreen.tsx": [/title: "Discard changes\?"/],
    "AddStallScreen.tsx": [/title: "Discard this stall\?"/],
    "ProfileConnectionsScreen.tsx": [/title: `Remove \$\{person\.name\}\?`/],
    "ProfileHomeScreen.tsx": [/title: "Sign out"/],
    "SettingsScreen.tsx": [
      /title: "Reset food history"/,
      /title: "Clear local cache"/,
      /title: "Sign out of all devices"/,
      /title: "Couldn't change visibility"/,
    ],
  };
  for (const [file, patterns] of Object.entries(expectations)) {
    const source = readFileSync(path.join(dir, file), "utf8");
    assert.match(source, /confirmAction\(/, file);
    for (const pattern of patterns) assert.match(source, pattern, file);
  }
});

test("failures on the profile screens go to reportError, not console.error", () => {
  for (const file of [
    "ProfileConnectionsScreen.tsx",
    "FollowRequestsScreen.tsx",
    "PassportScreen.tsx",
    "EditProfileScreen.tsx",
  ]) {
    const source = readFileSync(path.join(dir, file), "utf8");
    assert.match(source, /reportError\(/, file);
    assert.doesNotMatch(source, /console\.error\(/, file);
  }
  const store = readFileSync(path.join(process.cwd(), "src/store/useSocialStore.ts"), "utf8");
  assert.match(store, /action: "cancel_follow_request"/);
  assert.match(store, /action: "sync_follow_state"/);
});

test("Edit profile never rewrites dietary preferences (SET4-9)", () => {
  const source = readFileSync(path.join(dir, "EditProfileScreen.tsx"), "utf8");
  assert.doesNotMatch(source, /dietaryPreferences/);
});
