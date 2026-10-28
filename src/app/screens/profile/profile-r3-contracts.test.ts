// Round-three profile fixes that are layout or copy only (behaviour is in profile.render.test.tsx).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");
const home = read("src/app/screens/profile/ProfileHomeScreen.tsx");
const other = read("src/app/screens/profile/UserProfileContent.tsx");

test("PROF-25: ReleaseProfile asks before signing out", () => {
  const source = read("src/app/screens/profile/ReleaseProfileScreen.tsx");
  assert.doesNotMatch(source, /onPress=\{signOut\}/);
  // A web-safe confirm (Alert.alert is a no-op on web): see confirmAction.test.ts.
  assert.match(source, /confirmAction\(\{[\s\S]*title: "Sign out"[\s\S]*onConfirm: signOut/);
});

test("PROF-22: both avatars fit inside their 80pt ring with its 2pt border", () => {
  assert.match(home, /const avatarSize = spacing\[20\] - 4;/);
  assert.match(
    other,
    /<Avatar name=\{authorName\} uri=\{resolvedAuthorAvatarUrl\} size=\{spacing\[20\] - 4\}/,
  );
});

test("PROF-X2 / PROF-17: View all is a 44pt target and the own toggle uses tab roles", () => {
  assert.match(home, /accessibilityLabel="View all reviews"[\s\S]{0,260}minHeight: 44/);
  assert.match(home, /accessibilityRole="tablist"/);
  assert.match(home, /accessibilityRole="tab"\s+accessibilityLabel="Show profile posts"/);
  assert.match(home, /accessibilityRole="tab"\s+accessibilityLabel="Show profile reviews"/);
});

test("PROF-16: one name for the Taste Fingerprint and plain wording", () => {
  assert.doesNotMatch(home, /Palate Fingerprint|Recalibrate taste vector|Recent Hawker Log/);
  // One retake button, on the Taste Fingerprint card; Edit profile no longer repeats it (R4 PROF4-23).
  assert.match(home, /label="Retake the taste quiz"/);
  assert.doesNotMatch(
    read("src/app/screens/profile/EditProfileScreen.tsx"),
    /Retake the taste quiz/,
  );
  assert.doesNotMatch(read("src/features/profile/ownContentActions.ts"), /everyone's feeds/);
});

test("PROF-18a / PROF-12: a local edit is marked edited, and failures use friendly copy", () => {
  const editor = read("src/features/profile/useOwnReviewEditor.tsx");
  assert.match(
    editor,
    /onUpdated\(\{ \.\.\.editing, \.\.\.patch, editedAt: new Date\(\)\.toISOString\(\) \}\)/,
  );
  assert.doesNotMatch(editor, /error\.message/);
  assert.match(editor, /reportError\(error/);
});

test("PROF-3: post tiles only open a post when Activity is on", () => {
  for (const source of [home, other]) {
    assert.match(
      source,
      /FEATURE_FLAGS\.activityEnabled \? \(\s*<Pressable[\s\S]*?"ActivityPostDetail"/,
    );
  }
});
