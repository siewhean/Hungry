// Round-five profile fixes, held in source: no glyph icons or emoji, no direct lucide imports
// (AppSymbol draws SF Symbols on iOS), reduced motion in the theme, Skeleton and toast.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), "utf8");

/** The Profile page and every row, card and list it opens (not the settings or passport screens). */
const PROFILE_FILES = [
  "src/app/screens/profile/ProfileHomeScreen.tsx",
  "src/app/screens/profile/UserProfileContent.tsx",
  "src/app/screens/profile/ProfileConnectionsScreen.tsx",
  "src/app/screens/profile/FollowRequestsScreen.tsx",
  "src/app/screens/profile/ReviewHistoryScreen.tsx",
  "src/app/screens/profile/EditProfileScreen.tsx",
  "src/components/profile/FavouriteDishesRow.tsx",
  "src/components/profile/ProfileReviewCard.tsx",
  "src/components/profile/ProfileStatRow.tsx",
  "src/components/profile/TasteRadar.tsx",
  "src/features/profile/useOwnReviewEditor.tsx",
  "src/components/ui/OverflowMenu.tsx",
  "src/components/ui/ListRow.tsx",
];

test("P5-2: no emoji or text-glyph icons in the profile files", () => {
  for (const file of PROFILE_FILES) {
    const source = read(file);
    assert.doesNotMatch(source, /[★☆✓✔✗✕]/u, `${file} has a text-glyph icon`);
    assert.doesNotMatch(source, /\p{Extended_Pictographic}/u, `${file} has an emoji`);
  }
});

test("P5-2: the profile files draw icons with AppSymbol, not lucide directly", () => {
  for (const file of PROFILE_FILES) {
    assert.doesNotMatch(
      read(file),
      /from "lucide-react-native"/,
      `${file} imports lucide-react-native directly`,
    );
  }
  const symbols = read("src/components/ui/AppSymbol.tsx");
  // iOS draws the SF Symbol; the other platforms draw the lucide icon of the same meaning.
  assert.match(symbols, /SymbolView/);
  for (const row of [
    /moreActions: \{ ios: "ellipsis\.circle"/,
    /rowActions: \{ ios: "ellipsis"/,
    /settings: \{ ios: "gearshape"/,
    /compose: \{ ios: "square\.and\.pencil"/,
    /camera: \{ ios: "camera\.fill"/,
    /rating: \{ ios: "star\.fill"/,
    /selected: \{ ios: "checkmark"/,
  ]) {
    assert.match(symbols, row);
  }
});

test("P5-3: the profile menu is a native menu, with a web dropdown only for the web build", () => {
  const menu = read("src/components/ui/OverflowMenu.tsx");
  assert.match(menu, /from "@react-native-menu\/menu"/);
  assert.match(menu, /Platform\.OS === "web" \? <WebMenu/);
  assert.match(menu, /displayInline: true/);
  const home = read("src/app/screens/profile/ProfileHomeScreen.tsx");
  assert.match(home, /<OverflowMenu/);
  assert.doesNotMatch(home, /<Menu color/);
  assert.match(home, /destructive: true/);
  assert.match(read("package.json"), /"@react-native-menu\/menu"/);
});

test("P5-4: lists use the plain ListRow, not a card per row", () => {
  assert.match(read("src/app/screens/profile/ProfileConnectionsScreen.tsx"), /<ListRow/);
  assert.match(read("src/app/screens/profile/FollowRequestsScreen.tsx"), /<ListRow/);
  assert.doesNotMatch(read("src/app/screens/profile/ProfileConnectionsScreen.tsx"), /<Card/);
  assert.doesNotMatch(read("src/app/screens/profile/FollowRequestsScreen.tsx"), /<Card/);
  assert.match(read("src/app/screens/profile/ReviewHistoryScreen.tsx"), /variant="row"/);
  assert.doesNotMatch(read("src/app/screens/profile/EditProfileScreen.tsx"), /<Card/);
});

test("P5-5: reduced motion lives in the theme and Skeleton and the toast follow it", () => {
  const theme = read("src/theme/index.tsx");
  assert.match(theme, /reducedMotion: boolean/);
  assert.match(theme, /useReduceMotion\(\)/);
  const skeleton = read("src/components/ui/Skeleton.tsx");
  assert.match(skeleton, /reducedMotion/);
  assert.match(skeleton, /if \(reducedMotion\) \{[\s\S]*?return;/);
  const toast = read("src/components/ui/FloatingToast.tsx");
  assert.match(toast, /reducedMotion/);
  // Reduce Motion fades in place; otherwise it rises from the tab bar and leaves downward.
  assert.match(toast, /FadeIn\.duration/);
  assert.match(toast, /FadeInUp\.duration/);
  assert.match(toast, /FadeOutDown\.duration/);
  assert.doesNotMatch(toast, /FadeInDown|FadeOutUp/);
});

test("P5-1: stat labels never break inside a word", () => {
  const row = read("src/components/profile/ProfileStatRow.tsx");
  assert.match(row, /numberOfLines=\{1\}/);
  assert.match(row, /adjustsFontSizeToFit/);
  assert.match(row, /minimumFontScale=\{0\.85\}/);
  assert.doesNotMatch(row, /numberOfLines=\{2\}/);
  assert.match(row, /shouldStackStats/);
});

test("P5-8, P5-10: plural stat labels, haptics on follow, approve and pins, pull to refresh", () => {
  assert.match(
    read("src/app/screens/profile/ProfileHomeScreen.tsx"),
    /pluralLabel\(ownReviewCount, "Review"\)/,
  );
  assert.match(
    read("src/app/screens/profile/ReviewHistoryScreen.tsx"),
    /pluralLabel\(reviewedCount, "Review"\)/,
  );
  assert.match(read("src/features/profile/useFollowPress.ts"), /confirmHaptic\(\)/);
  assert.match(read("src/app/screens/profile/FollowRequestsScreen.tsx"), /confirmHaptic\(\)/);
  assert.match(read("src/components/profile/FavouriteDishesRow.tsx"), /confirmHaptic\(\)/);
  const home = read("src/app/screens/profile/ProfileHomeScreen.tsx");
  assert.match(home, /<RefreshControl/);
  // The refresh reads counts, requests and reviews once each, in parallel: no per-row calls.
  assert.match(home, /Promise\.allSettled\(\[/);
});

test("P5-11, P5-12: trailing checkmark picker, Cancel and Save in the header, Edit picture", () => {
  const picker = read("src/components/profile/FavouriteDishesRow.tsx");
  assert.match(picker, /<AppSymbol name="selected"/);
  assert.match(picker, /favourite-dishes-counter/);
  const edit = read("src/app/screens/profile/EditProfileScreen.tsx");
  assert.match(edit, /headerLeft=\{/);
  assert.match(edit, /accessibilityLabel="Edit picture"/);
  assert.match(edit, /PROFILE_BIO_MAX_LENGTH - 30/);
});

test("P5-12: the shared back button draws chevron.backward on iOS (lucide arrow elsewhere)", () => {
  const header = read("src/components/ui/AppHeader.tsx");
  assert.match(header, /<AppSymbol name="back"/);
  assert.doesNotMatch(header, /lucide-react-native/);
  assert.match(read("src/components/ui/AppSymbol.tsx"), /back: \{ ios: "chevron\.backward"/);
});

test("P5-13, P5-14: the radar is the hero and the copy reads plainly", () => {
  const home = read("src/app/screens/profile/ProfileHomeScreen.tsx");
  assert.match(home, /\{hasTasteFingerprint \? tasteCard : null\}/);
  assert.match(home, /You like it less/);
  assert.doesNotMatch(home, /You prefer mild/);
  const radar = read("src/components/profile/TasteRadar.tsx");
  assert.match(radar, /RADAR_MAX_WIDTH = 260/);
  assert.match(radar, /fillOpacity=\{0\.18\}/);
  assert.match(radar, /See all six/);
  const connections = read("src/app/screens/profile/ProfileConnectionsScreen.tsx");
  assert.match(connections, /Find people to follow/);
  assert.match(connections, /Search by name to follow friends and see what they rate\./);
  assert.doesNotMatch(connections, /You aren't following anyone yet/);
});
