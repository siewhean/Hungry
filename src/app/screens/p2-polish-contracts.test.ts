import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { colors } from "@/theme/tokens";

function read(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("P2-1: every new-password field shows the live requirements checklist", () => {
  for (const file of [
    "src/app/screens/auth/SignUpScreen.tsx",
    "src/app/screens/auth/ResetPasswordScreen.tsx",
    "src/app/screens/onboarding/OnboardingAuthScreen.tsx",
  ]) {
    const source = read(file);
    assert.match(source, /<PasswordRequirements password=\{/, file);
    // Submit-time validation is kept alongside the upfront checklist.
    assert.match(source, /validatePassword\(value\)/, file);
  }
  const checklist = read("src/app/screens/auth/PasswordRequirements.tsx");
  assert.match(checklist, /getPasswordRuleStatuses\(/);
  assert.match(checklist, /accessibilityLabel=\{`Password requirements/);
  // Met state is shape + text, not colour alone.
  assert.match(checklist, /<CheckCircle2[\s\S]*<Circle /);
});

test("P2-2: search clear works on the first tap with the keyboard up and keeps focus", () => {
  const dishSearch = read("src/app/screens/search/DishSearchScreen.tsx");
  // Screen's ScrollView always persists taps ("handled"), so DishSearch needs no prop.
  assert.match(dishSearch, /searchInputRef\.current\?\.focus\(\)/);
  assert.match(read("src/components/ui/Screen.tsx"), /keyboardShouldPersistTaps="handled"/);

  const resultsScreen = read("src/app/screens/search/SearchResultsScreen.tsx");
  assert.match(resultsScreen, /keyboardShouldPersistTaps="handled"/);
  assert.match(resultsScreen, /rawSearchInputRef\.current\?\.focus\(\)/);
});

test("P2-3: auth scroll containers clip content below the top safe-area inset", () => {
  // AuthScreenShell scrolls inside Screen, whose SafeAreaView pads the top edge.
  const shell = read("src/app/screens/auth/AuthScreenShell.tsx");
  assert.match(shell, /<Screen scroll=\{false\}>\s*<ScrollView/);
  assert.match(read("src/components/ui/Screen.tsx"), /edges=\{\["top", "left", "right"\]\}/);

  // Onboarding sign-up owns its own ScrollView: the inset must sit on the
  // container, not inside the scrolling content (retest final-76).
  const onboarding = read("src/app/screens/onboarding/OnboardingAuthScreen.tsx");
  assert.match(onboarding, /backgroundColor: palette\.bg, paddingTop: insets\.top \}/);
  assert.doesNotMatch(onboarding, /paddingTop: insets\.top \+/);
});

test("P2-4: destructive dialog actions use the AA destructive fill and light label", () => {
  const dialog = read("src/components/ui/Dialog.tsx");
  assert.match(dialog, /btn\.style === "destructive"\s*\?\s*"destructive"/);
  assert.doesNotMatch(dialog, /backgroundColor: palette\.error/);

  const button = read("src/components/ui/Button.tsx");
  assert.match(button, /backgroundColor: palette\.destructive/);
  assert.match(button, /variant === "destructive"\s*\?\s*palette\.textOnDestructive/);

  // Dark mode keeps dark ink on orange, so its destructive label must differ from it.
  assert.notEqual(colors.dark.textOnDestructive, colors.dark.textOnOrange);
});
