import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("Button exposes disabled and busy accessibility state without dropping caller state", () => {
  const source = read("src/components/ui/Button.tsx");

  assert.match(source, /Accessibility contract:/);
  assert.match(source, /accessibilityState=\{\{/);
  assert.match(source, /\.\.\.accessibilityState/);
  assert.match(source, /disabled: Boolean\(accessibilityState\?\.disabled \|\| isDisabled\)/);
  assert.match(source, /busy: Boolean\(accessibilityState\?\.busy \|\| loading\)/);
  assert.match(source, /accessibilityLabel=\{accessibilityLabel \?\? label\}/);
  assert.match(source, /backgroundColor: palette\.orange/);
  assert.match(source, /variant === "primary"[\s\S]*\? palette\.textOnOrange/);
});

test("AppText bounds OS font scaling so fixed-format mobile UI does not clip", () => {
  const source = read("src/components/ui/AppText.tsx");
  const tokens = read("src/theme/tokens.ts");
  const theme = read("src/theme/index.tsx");

  assert.match(tokens, /export const fontScaling = \{/);
  assert.match(tokens, /displayMaxMultiplier: 1\.5/);
  assert.match(tokens, /headingMaxMultiplier: 1\.6/);
  assert.match(tokens, /bodyMaxMultiplier: 2/);
  assert.match(tokens, /compactMaxMultiplier: 2/);
  assert.match(theme, /fontScaling: typeof fontScaling/);
  assert.match(source, /maxFontSizeMultiplier,/);
  assert.match(source, /allowFontScaling,/);
  assert.match(source, /allowFontScaling=\{allowFontScaling \?\? true\}/);
  assert.match(
    source,
    /maxFontSizeMultiplier=\{maxFontSizeMultiplier \?\? defaultMaxFontSizeMultiplier\}/,
  );
  assert.match(source, /variant === "micro" \|\| variant === "price" \|\| variant === "code"/);
});

test("Input has a stable label fallback and moving placeholders are opt-in only", () => {
  const source = read("src/components/ui/Input.tsx");
  const expandableSearch = read("src/components/ui/ExpandableSearchLauncher.tsx");

  assert.match(source, /Accessibility contract:/);
  assert.match(source, /AccessibilityInfo\.isScreenReaderEnabled/);
  assert.match(source, /screenReaderChanged/);
  assert.match(source, /enableMovingPlaceholder === true/);
  assert.doesNotMatch(source, /\^\(search\|find\)/);
  assert.match(expandableSearch, /enableMovingPlaceholder === true/);
  assert.doesNotMatch(expandableSearch, /\^\(search\|find\)/);
  assert.match(source, /props\.accessibilityLabel \?\? label \?\? \(staticPlaceholder/);
  assert.match(source, /accessibilityLabel=\{accessibilityLabel\}/);
  assert.match(source, /allowFontScaling=\{allowFontScaling \?\? true\}/);
  assert.match(
    source,
    /maxFontSizeMultiplier=\{maxFontSizeMultiplier \?\? fontScaling\.bodyMaxMultiplier\}/,
  );
  assert.match(expandableSearch, /accessibilityLabel=\{accessibilityLabel \?\? placeholder\}/);
  assert.match(expandableSearch, /accessibilityLabel="Clear search"/);
  assert.match(expandableSearch, /accessibilityHint="Clears the current search query"/);
});

test("Dialog and BottomSheet expose native modal semantics and labelled dismiss targets", () => {
  const dialog = read("src/components/ui/Dialog.tsx");
  const bottomSheet = read("src/components/ui/BottomSheet.tsx");
  const reviewSuccess = read("src/app/screens/review/ReviewSuccessModal.tsx");
  const wheelEntry = read("src/app/screens/wheel/WheelEntryAddSheet.tsx");

  assert.match(dialog, /Accessibility contract:/);
  assert.match(dialog, /AccessibilityInfo\.announceForAccessibility\(title\)/);
  assert.match(dialog, /accessibilityViewIsModal/);
  assert.match(dialog, /accessibilityRole="header"/);
  assert.doesNotMatch(dialog, /accessibilityRole="alert"/);
  assert.doesNotMatch(dialog, /<View\s+accessible/);
  assert.match(dialog, /accessibilityLabel="Close dialog"/);
  assert.match(dialog, /accessibilityHint="Dismisses the dialog"/);

  assert.match(bottomSheet, /Accessibility contract:/);
  assert.match(bottomSheet, /accessibilityLabel\?: string/);
  assert.match(bottomSheet, /accessibilityLabel = "Bottom sheet"/);
  assert.match(bottomSheet, /accessibilityLabel="Close bottom sheet"/);
  assert.match(bottomSheet, /accessibilityHint="Dismisses the current bottom sheet"/);
  assert.match(bottomSheet, /accessibilityViewIsModal/);

  assert.match(reviewSuccess, /<Modal[\s\S]*accessibilityViewIsModal/);
  assert.match(reviewSuccess, /accessibilityLabel="Close review success"/);
  assert.match(reviewSuccess, /accessibilityHint="Dismisses the review confirmation"/);
  assert.match(wheelEntry, /<Modal[\s\S]*accessibilityViewIsModal/);
  assert.match(wheelEntry, /accessibilityLabel="Close add option sheet"/);
  assert.match(wheelEntry, /accessibilityHint="Dismisses the option picker"/);
});

test("production bottom sheet surfaces expose contextual modal labels", () => {
  const directBottomSheetFiles = [
    "src/app/screens/home/HomeFeedScreen.tsx",
    "src/app/screens/profile/ProfileHomeScreen.tsx",
    "src/app/screens/review/ReviewShareSheet.tsx",
    "src/components/social/ReviewCommentsSheet.tsx",
    "src/features/post/components/LocationSearchModal.tsx",
  ];

  for (const relativePath of directBottomSheetFiles) {
    const source = read(relativePath);
    const modalBlocks = source.match(/^\s*<BottomSheetModal[\s\S]*?^\s*>/gm) ?? [];

    assert.ok(modalBlocks.length > 0, `${relativePath} should render a bottom sheet`);
    for (const block of modalBlocks) {
      assert.match(block, /accessibilityLabel=/, `${relativePath} bottom sheet needs a label`);
      assert.match(block, /accessibilityViewIsModal/, `${relativePath} bottom sheet must be modal`);
    }

    const backdropBlocks = source.match(/<BottomSheetBackdrop\s[\s\S]*?\/>/g) ?? [];
    assert.ok(backdropBlocks.length > 0, `${relativePath} should render a dismiss backdrop`);
    for (const block of backdropBlocks) {
      assert.match(
        block,
        /accessibilityRole="button"/,
        `${relativePath} backdrop needs button role`,
      );
      assert.match(block, /accessibilityLabel=/, `${relativePath} backdrop needs a close label`);
      assert.match(block, /accessibilityHint=/, `${relativePath} backdrop needs a dismiss hint`);
    }
  }
});

test("profile controls discovered in runtime hierarchy expose labels and selected state", () => {
  const source = read("src/app/screens/profile/ProfileHomeScreen.tsx");

  assert.match(
    source,
    /label="Edit"[\s\S]*onPress=\{\(\) => navigation\.navigate\("EditProfile"\)\}/,
  );
  assert.match(source, /accessibilityLabel="Share Taste Fingerprint"/);
  assert.match(source, /accessibilityHint="Opens sharing options for your Taste Fingerprint"/);
  assert.match(source, /accessibilityLabel="Show profile posts"/);
  assert.match(source, /accessibilityState=\{\{ selected: activeShareTab === "posts" \}\}/);
  assert.match(source, /accessibilityState=\{\{ selected: activeShareTab === "reviews" \}\}/);
});

test("shared BottomSheet callers provide contextual labels instead of generic fallback", () => {
  const labelledCallerFiles = [
    "src/components/merchant/OutletSwitcher.tsx",
    "src/components/stall/PopularVisitorsSection.tsx",
    "src/features/post/components/CollaboratorModal.tsx",
    "src/features/post/components/MusicSearchModal.tsx",
  ];

  for (const relativePath of labelledCallerFiles) {
    const source = read(relativePath);
    const bottomSheetBlocks = source.match(/<BottomSheet(?:\s|>)[\s\S]*?>/g) ?? [];

    assert.ok(bottomSheetBlocks.length > 0, `${relativePath} should render a shared BottomSheet`);
    for (const block of bottomSheetBlocks) {
      assert.match(block, /accessibilityLabel=/, `${relativePath} BottomSheet needs context`);
    }
  }
});

test("bottom sheet nested controls expose roles, labels, and selected state where needed", () => {
  const music = read("src/features/post/components/MusicSearchModal.tsx");
  const collaborators = read("src/features/post/components/CollaboratorModal.tsx");
  const locations = read("src/features/post/components/LocationSearchModal.tsx");
  const outletSwitcher = read("src/components/merchant/OutletSwitcher.tsx");
  const homeFeed = read("src/app/screens/home/HomeFeedScreen.tsx");

  assert.match(
    music,
    /accessibilityLabel=\{\`\$\{isSelected \? "Selected music" : "Select music"\}/,
  );
  assert.match(music, /accessibilityLabel=\{\`\$\{isPlaying \? "Pause" : "Play"\} preview/);
  assert.match(music, /accessibilityState=\{\{ selected: isSelected \}\}/);
  assert.match(music, /accessibilityState=\{\{ selected: isPlaying \}\}/);

  assert.match(
    collaborators,
    /accessibilityLabel=\{\`\$\{isSelected \? "Remove" : "Add"\} collaborator/,
  );
  assert.match(collaborators, /accessibilityState=\{\{ selected: isSelected \}\}/);

  assert.match(
    locations,
    /accessibilityLabel=\{\`Select location \$\{item\.name\}, \$\{item\.address\}\`\}/,
  );
  assert.match(locations, /accessibilityState=\{\{ selected: selectedLoc\?\.id === item\.id \}\}/);

  assert.match(
    outletSwitcher,
    /accessibilityLabel=\{\`Switch outlet, current outlet \$\{activeOutlet\.name\}\`\}/,
  );
  assert.match(
    outletSwitcher,
    /accessibilityLabel=\{\`\$\{isActive \? "Current outlet" : "Switch to outlet"\}/,
  );
  assert.match(outletSwitcher, /accessibilityState=\{\{ selected: isActive \}\}/);

  assert.match(homeFeed, /accessibilityLabel="Cancel reply"/);
  assert.match(homeFeed, /accessibilityHint="Stops replying to the selected comment"/);
});

test("Avatar and Card avoid duplicate or unsupported announcements", () => {
  const avatar = read("src/components/ui/Avatar.tsx");
  const accessibleImage = read("src/components/ui/AccessibleImage.tsx");
  const card = read("src/components/ui/Card.tsx");
  const chip = read("src/components/ui/Chip.tsx");

  assert.match(avatar, /<View\s+accessible/);
  assert.match(avatar, /accessibilityRole="image"/);
  assert.match(avatar, /decorative/);
  assert.match(accessibleImage, /accessibilityElementsHidden/);
  assert.doesNotMatch(card, /accessibilityRole="article"/);
  // A button by default; a "tab" when it sits in a tablist (Search mode switch).
  assert.match(chip, /accessibilityRole = "button"/);
  assert.match(chip, /accessibilityLabel=\{accessibilityLabel \?\? label\}/);
  assert.match(chip, /accessibilityState=\{\{ selected \}\}/);
});

test("accessibility implementation guide documents source contracts and runtime smoke gaps", () => {
  const guide = read("docs/accessibility-style-guide.md");

  assert.match(guide, /WCAG 2\.1 AA/);
  assert.match(guide, /Button/);
  assert.match(guide, /AccessibleImage/);
  assert.match(guide, /VoiceOver/);
  assert.match(guide, /TalkBack/);
  assert.match(guide, /keyboard/);
  assert.match(guide, /reduced motion/);

  const readme = read("README.md");
  assert.match(readme, /docs\/accessibility-style-guide\.md/);
});
