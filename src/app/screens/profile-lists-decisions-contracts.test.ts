// Contracts for sh's Profile and lists decisions 17-22 (medium-low-decisions.md).
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { createRootLinking } from "@/app/navigation/linking";
import { webShareUrl } from "@/constants/links";
import { PROFILE_BIO_MAX_LENGTH } from "@/features/profile/profileBio";
import { pickSurpriseCandidate, SURPRISE_NEAREST_POOL } from "@/features/wheel/surprisePick";
import { hungryService } from "@/lib/services/mock/mockService";

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("17: checklist items have no reminder field until notifications ship", () => {
  const picker = read("src/app/screens/checklist/ChecklistItemPickerScreen.tsx");
  const row = read("src/components/checklist/ChecklistItemRow.tsx");
  assert.doesNotMatch(picker, /Remind me|reminderAt:|REMINDER_PATTERN/);
  assert.match(picker, /Planned visit date/);
  assert.doesNotMatch(row, /Reminder /);
});

test("18: copy actions use expo-clipboard, not React Native's removed Clipboard", () => {
  const pkg = JSON.parse(read("package.json")) as { dependencies: Record<string, string> };
  assert.ok(pkg.dependencies["expo-clipboard"]);
  const offenders = execSync(
    "grep -rlE 'import \\{[^}]*\\bClipboard\\b[^}]*\\} from \"react-native\"' src || true",
    { cwd: root, encoding: "utf8" },
  ).trim();
  assert.equal(offenders, "");
  const lobby = read("src/app/screens/wheel/WheelLobbyScreen.tsx");
  // The party-code button copies the code instead of opening the share sheet.
  assert.match(lobby, /Clipboard\.setStringAsync\(party!\.code\)/);
  assert.doesNotMatch(lobby, /Share\.share/);
  const profile = read("src/app/screens/profile/ProfileHomeScreen.tsx");
  assert.match(profile, /Clipboard\.setStringAsync\(/);
  assert.match(profile, /profileShareUrl\(profile\.id, "copy_link"\)/);
});

test("19: user/:id links open UserProfile and share URLs use usehungry.com/user", () => {
  assert.equal(webShareUrl("user", "abc-123"), "https://usehungry.com/user/abc-123");
  const linking = createRootLinking("exp://127.0.0.1:8081/--/", () => ({
    isAuthReady: true,
    isAuthenticated: false,
  }));
  const screens = linking.config.screens as Record<string, unknown>;
  assert.equal(screens.UserProfile, "user/:authorId");
  // Guests can open a shared profile; unsafe ids are dropped.
  assert.deepEqual(linking.getStateFromPath("user/11111111-2222-3333-4444-555555555555")?.routes, [
    { name: "MainTabs", params: { screen: "Home" } },
    { name: "UserProfile", params: { authorId: "11111111-2222-3333-4444-555555555555" } },
  ]);
  assert.equal(linking.getStateFromPath("user/%3Cscript%3E"), undefined);

  assert.match(read("app.json"), /"pathPrefix": "\/user\/"/);
  const web = "marketing/website/web-v2/src";
  assert.match(read(`${web}/app/.well-known/apple-app-site-association/route.ts`), /"\/user\/\*"/);
  const page = read(`${web}/app/user/[id]/page.tsx`);
  assert.match(page, /getSharedProfile/);
  assert.match(page, /appPath=\{`user\/\$\{encodeURIComponent\(profile\.id\)\}`\}/);
  const shared = read(`${web}/lib/share/sharedLinks.ts`);
  assert.match(shared, /rest\/v1\/public_profiles/);
  assert.match(shared, /supabaseFetchOnDemand<PublicProfileRow\[\]>/);

  const other = read("src/app/screens/profile/UserProfileContent.tsx");
  assert.match(other, /shareProfileLink\(resolvedAuthorId, authorName\)/);
  assert.match(other, /getPublicProfile\(normalizedAuthorId\)/);
  assert.match(read("src/app/screens/profile/ProfileHomeScreen.tsx"), /label="Share profile"/);
});

test("20: bio is capped at 150 characters in the database, the editor and the mock", async () => {
  assert.equal(PROFILE_BIO_MAX_LENGTH, 150);
  const migration = read("supabase/migrations/20261020120000_profile_bio.sql");
  assert.match(migration, /check \(bio is null or char_length\(bio\) <= 150\)/);
  assert.match(migration, /bio = excluded\.bio/);
  assert.doesNotMatch(migration, /grant .* to anon/i);
  assert.ok(existsSync(path.join(root, "supabase/smoke/profile_bio.sql")));

  const edit = read("src/app/screens/profile/EditProfileScreen.tsx");
  assert.match(edit, /maxLength=\{PROFILE_BIO_MAX_LENGTH\}/);
  assert.match(edit, /helperText=\{`\$\{bio\.length\}\/\$\{PROFILE_BIO_MAX_LENGTH\}`\}/);
  assert.match(read("src/app/screens/profile/ProfileHomeScreen.tsx"), /profile\.bio \?/);

  const saved = await hungryService.profile.updateProfile({ bio: "  Laksa hunter  " });
  assert.equal(saved.bio, "Laksa hunter");
  await assert.rejects(hungryService.profile.updateProfile({ bio: "x".repeat(151) }));
  const own = await hungryService.profile.getPublicProfile(saved.id);
  assert.equal(own?.bio, "Laksa hunter");
  await hungryService.profile.updateProfile({ bio: "" });
});

test("21: one Lists area, and Saved has Dishes, Stalls and Lists tabs", () => {
  assert.match(read("src/app/screens/profile/ProfileStack.tsx"), /name="ListsHome"/);
  const home = read("src/app/screens/profile/ProfileHomeScreen.tsx");
  assert.match(home, /label="Lists"/);
  assert.doesNotMatch(home, /label="My Checklists"|label="Hungry Portfolios"/);
  const lists = read("src/app/screens/profile/ListsHomeScreen.tsx");
  assert.match(lists, /navigation\.navigate\("Favourites", undefined, \{ pop: true \}\)/);
  assert.match(lists, /navigation\.navigate\("PortfoliosHome"\)/);
  assert.match(lists, /FEATURE_FLAGS\.collectionsEnabled \?/);
  const saved = read("src/app/screens/profile/FavouritesScreen.tsx");
  assert.match(saved, /dishes: "Dishes",\s*stalls: "Stalls",\s*lists: "Lists"/);
  assert.match(saved, /useStallFollowStore/);
  assert.match(saved, /navigation\.navigate\("ListsHome", undefined, \{ pop: true \}\)/);
});

test("22: Surprise me picks among the closest stalls only when location is in use", () => {
  const near = { latitude: 1.3, longitude: 103.8 };
  const candidates = Array.from({ length: SURPRISE_NEAREST_POOL + 4 }, (_, index) => ({
    item: `stall-${index}`,
    coordinate: { latitude: near.latitude + index * 0.01, longitude: near.longitude },
  }));
  const reversed = [...candidates].reverse();
  // random() just under 1 takes the last of the pool: the 8th closest, not the farthest.
  assert.equal(
    pickSurpriseCandidate(reversed, near, () => 0.999),
    `stall-${SURPRISE_NEAREST_POOL - 1}`,
  );
  assert.equal(
    pickSurpriseCandidate(reversed, near, () => 0),
    "stall-0",
  );
  // No location: uniform over every stall, as before.
  assert.equal(
    pickSurpriseCandidate(reversed, undefined, () => 0),
    `stall-${SURPRISE_NEAREST_POOL + 3}`,
  );
  assert.equal(pickSurpriseCandidate([], near), undefined);

  const sheet = read("src/app/screens/wheel/WheelEntryAddSheet.tsx");
  assert.match(sheet, /const usesLocation = locationPermission === "granted";/);
  assert.doesNotMatch(sheet, /nearby/i);
});
