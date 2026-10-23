import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("Achievements uses real passport progress in the Stitch layout", () => {
  const screen = read("src/app/screens/profile/PassportScreen.tsx");

  assert.match(screen, /ProfileScreenShell title="Achievements"/);
  assert.match(screen, /getEarnedPassportStamps\(progressMap\)/);
  assert.match(screen, /getNextPassportStamp\(progressMap\)/);
  assert.match(screen, /\{totalStamps\} \/ \{PASSPORT_STAMP_DEFINITIONS\.length\} stamps/);
  assert.match(screen, /<WeeklyGoalCard[\s\S]*progress=\{weeklyGoal\}/);
  assert.match(screen, /<HeritageStampTile[\s\S]*?earned=\{earned\}/);
  assert.match(screen, /passportRankTitle\(totalStamps\)/);
  assert.doesNotMatch(screen, /voucher|rank #|Secret Queue Tips/i);
});

test("Settings follows the Stitch groups with working account and privacy controls", () => {
  const screen = read("src/app/screens/profile/SettingsScreen.tsx");
  const sections = [
    'title="Dining preferences"',
    'title="Location & notifications"',
    'title="Account & sync"',
    'title="Data & privacy"',
  ];

  for (const section of sections) assert.match(screen, new RegExp(section));
  assert.deepEqual(
    sections.map((section) => screen.indexOf(section)).sort((a, b) => a - b),
    sections.map((section) => screen.indexOf(section)),
  );
  assert.match(screen, /label="Dietary preferences"[\s\S]*initialPhase: "dietary"/);
  assert.match(screen, /label="Flavour profile"[\s\S]*initialPhase: "taste"/);
  assert.match(screen, /label="Meal budget"[\s\S]*profile\.maxDishBudget/);
  assert.match(screen, /label="Download my data"|"Preparing your data…"/);
  assert.match(screen, /onPress=\{handleSignOut\}/);
  assert.match(screen, /onPress=\{handleDeleteAccount\}/);
  assert.doesNotMatch(screen, /Queue-wait alerts|Taste vector sharing|114 centres saved/);
});
