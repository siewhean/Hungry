import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  formatPortfolioSummary,
  isPortfolioLive,
  resolveListItemCount,
} from "@/features/checklistPortfolio/listLabels";
import { selectActiveWheelEntries } from "@/store/useWheelStore";
import type { WheelEntry } from "@/types/domain";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("list cards use server item counts and human labels", () => {
  assert.equal(resolveListItemCount({ itemCount: 4 }, []), 4);
  assert.equal(resolveListItemCount({}, [1, 2]), 2);
  assert.equal(resolveListItemCount({}), 0);
  assert.equal(
    formatPortfolioSummary({ type: "recommendation", visibility: "followers_only" }, 1),
    "Recommendations · Followers · 1 item",
  );

  const service = read("src/lib/services/supabase/supabaseService.ts");
  assert.match(service, /portfolio_items\(count\)/);
  assert.match(service, /checklist_items\(count\)/);
  assert.match(service, /\.limit\(PORTFOLIO_LIST_LIMIT\)/);
  assert.match(
    read("src/app/screens/checklist/ChecklistsHomeScreen.tsx"),
    /resolveListItemCount\(item, items\[item\.id\]\)/,
  );
});

test("publish is confirmed, reversible, and the badge follows visibility", () => {
  assert.equal(isPortfolioLive({ publishedAt: "2026-01-01", visibility: "public" }), true);
  assert.equal(isPortfolioLive({ publishedAt: "2026-01-01", visibility: "private" }), false);
  const detail = read("src/app/screens/portfolio/PortfolioDetailScreen.tsx");
  assert.match(detail, /Publish this list\?/);
  assert.match(detail, /Unpublish this list\?/);
  assert.match(detail, /updatePortfolio\(portfolio\.id, \{ visibility: "private" \}\)/);
  assert.match(detail, /await deletePortfolio\(portfolio\.id\)/);
  assert.match(detail, /\{portfolio\.name\}/);
  assert.doesNotMatch(detail, /Hungry Portfolio</);
});

test("portfolio detail loads only its list and the follow state", () => {
  const detail = read("src/app/screens/portfolio/PortfolioDetailScreen.tsx");
  assert.match(detail, /refreshPortfolio\(portfolioId\)/);
  assert.match(detail, /checkFollowStatus\(portfolioId\)/);
  assert.doesNotMatch(detail, /loadPortfolios\(\)/);
  assert.match(
    read("src/app/screens/portfolio/PortfoliosHomeScreen.tsx"),
    /loadFollowedPortfolios/,
  );
});

test("picker scores are optional whole numbers and the edit-later copy is gone", () => {
  const picker = read("src/app/screens/portfolio/PortfolioItemPickerScreen.tsx");
  assert.match(picker, /useState\(""\)/);
  assert.match(picker, /keyboardType="number-pad"/);
  assert.doesNotMatch(picker, /edited later/);
  assert.match(read("src/store/usePortfolioStore.ts"), /Math\.round\(score\)/);
});

test("pickers debounce search and drop stale results", () => {
  for (const file of [
    "src/app/screens/portfolio/PortfolioItemPickerScreen.tsx",
    "src/app/screens/checklist/ChecklistItemPickerScreen.tsx",
  ]) {
    const source = read(file);
    assert.match(source, /setTimeout\(/, file);
    assert.match(source, /clearTimeout\(timer\)/, file);
    assert.match(source, /mounted = false/, file);
  }
});

test("portfolio screens pad for the top safe area", () => {
  for (const name of [
    "PortfolioDetailScreen",
    "PortfolioCreateScreen",
    "PortfolioEditScreen",
    "PortfolioItemPickerScreen",
    "PortfolioCollaboratorsScreen",
    "PortfolioSearchScreen",
    "PortfolioPublicViewScreen",
  ]) {
    assert.match(read(`src/app/screens/portfolio/${name}.tsx`), /useSafeAreaInsets\(\)/, name);
  }
});

test("rows say Loading instead of Deleted while names load; screens use selectors", () => {
  for (const file of [
    "src/app/screens/portfolio/PortfolioDetailScreen.tsx",
    "src/app/screens/checklist/ChecklistDetailScreen.tsx",
  ]) {
    const source = read(file);
    assert.match(source, /labelsLoaded \? "Deleted dish" : "Loading…"/, file);
    assert.match(source, /useShallow\(/, file);
  }
  assert.match(read("src/app/screens/portfolio/PortfoliosHomeScreen.tsx"), /useShallow\(/);
  assert.match(read("src/app/screens/checklist/ChecklistsHomeScreen.tsx"), /useShallow\(/);
});

test("wheel draws and spins the same deduped slices", () => {
  const entry = { id: "a", isEliminated: false } as WheelEntry;
  const out = { id: "b", isEliminated: true } as WheelEntry;
  assert.deepEqual(
    selectActiveWheelEntries([entry, entry, out]).map((e) => e.id),
    ["a"],
  );
  for (const file of [
    "src/components/wheel/WheelSvg.tsx",
    "src/app/screens/wheel/WheelSpinScreen.tsx",
    "src/app/screens/wheel/WheelLobbyScreen.tsx",
  ]) {
    assert.match(read(file), /selectActiveWheelEntries\(/, file);
  }
  assert.match(read("src/app/screens/wheel/WheelSpinScreen.tsx"), /activeEntriesRef\.current/);
});

test("leaving the wheel clears the party, and lost state offers a new wheel", () => {
  assert.match(read("src/app/screens/wheel/WheelStack.tsx"), /leaveParty\(\)/);
  assert.match(read("src/store/useWheelStore.ts"), /mockPartyStore\.delete\(party\.code\)/);
  for (const file of [
    "src/app/screens/wheel/WheelSpinScreen.tsx",
    "src/app/screens/wheel/WheelLobbyScreen.tsx",
  ]) {
    const source = read(file);
    assert.match(source, /Start a new wheel/, file);
    assert.doesNotMatch(source, /if \(!party\) return null;/, file);
  }
});

test("wheel accessibility: contrast, reduce motion, throttled haptics, labels, winner", () => {
  const svg = read("src/components/wheel/WheelSvg.tsx");
  assert.match(svg, /palette\.textOnOrange/);
  assert.doesNotMatch(svg, /palette\.textOnDark/);
  const spin = read("src/app/screens/wheel/WheelSpinScreen.tsx");
  assert.match(spin, /useReduceMotion\(\)/);
  assert.match(spin, /HAPTIC_MIN_INTERVAL_MS/);
  assert.match(spin, /announceForAccessibility/);
  assert.doesNotMatch(spin, /🎡|⏳/);
  assert.match(
    read("src/app/screens/wheel/WheelLobbyScreen.tsx"),
    /accessibilityLabel=\{`Remove \$\{item\.label\} from the wheel`\}/,
  );
});

test("surprise me is honest, checks every dish, and caps the wheel", () => {
  const sheet = read("src/app/screens/wheel/WheelEntryAddSheet.tsx");
  assert.doesNotMatch(sheet, /random nearby stall/);
  assert.match(sheet, /dishes\.some\(\(dish\) => dish\.dietaryFlags\.includes\(pref\)\)/);
  assert.match(sheet, /MAX_WHEEL_ENTRIES = 12/);
  assert.match(sheet, /Every stall is already on the wheel/);
  assert.match(read("src/app/screens/wheel/WheelHomeScreen.tsx"), /dietaryPreferences/);
});

test("wheel and list analytics fire", () => {
  const store = read("src/store/useWheelStore.ts");
  assert.match(store, /"wheel_option_added"/);
  assert.match(store, /"wheel_spun"/);
  assert.match(read("src/app/screens/wheel/WheelStack.tsx"), /"wheel_opened"/);
  assert.match(read("src/app/screens/wheel/WheelResultModal.tsx"), /"wheel_result_viewed"/);
  assert.match(read("src/store/useChecklistStore.ts"), /"list_item_removed"/);
  assert.match(read("src/store/usePortfolioStore.ts"), /"list_item_removed"/);
  assert.match(read("src/app/screens/portfolio/PortfoliosHomeScreen.tsx"), /"list_load_failed"/);
});

test("blog post has a not-found state and the checklist has no reminder field", () => {
  const blog = read("src/app/screens/reads/BlogPostWebViewScreen.tsx");
  assert.match(blog, /Article not found/);
  assert.doesNotMatch(blog, /\?\? posts\[0\]/);
  assert.doesNotMatch(
    read("src/app/screens/checklist/ChecklistItemPickerScreen.tsx"),
    /Remind me|reminderDateTime/,
  );
});
