import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  formatPortfolioSummary,
  isPortfolioLive,
  resolveListItemCount,
} from "@/features/checklistPortfolio/listLabels";

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
