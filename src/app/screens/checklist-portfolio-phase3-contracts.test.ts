import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("checklist and portfolio Phase 3 screens are registered in profile navigation", () => {
  const profileStack = read("src/app/screens/profile/ProfileStack.tsx");
  const rootNavigator = read("src/app/navigation/RootNavigator.tsx");
  const linking = read("src/app/navigation/linking.ts");

  [
    "ChecklistsHome",
    "ChecklistDetail",
    "ChecklistItemPicker",
    "PortfoliosHome",
    "PortfolioDetail",
    "PortfolioCreate",
    "PortfolioEdit",
    "PortfolioItemPicker",
    "PortfolioCollaborators",
    "PortfolioSearch",
  ].forEach((routeName) => {
    assert.match(
      profileStack,
      new RegExp(`name="${routeName}"`),
      `${routeName} must be conditionally registered in ProfileStack`,
    );
  });
  assert.match(profileStack, /FEATURE_FLAGS\.collectionsEnabled \? \(/);
  assert.doesNotMatch(profileStack, /import \{ ChecklistsHomeScreen \}/);
  assert.match(profileStack, /getComponent=\{loadChecklistsHomeScreen\}/);
  assert.match(profileStack, /getComponent=\{loadPortfoliosHomeScreen\}/);

  [
    "src/app/screens/checklist/ChecklistsHomeScreen.tsx",
    "src/app/screens/checklist/ChecklistDetailScreen.tsx",
    "src/app/screens/checklist/ChecklistItemPickerScreen.tsx",
    "src/app/screens/portfolio/PortfoliosHomeScreen.tsx",
    "src/app/screens/portfolio/PortfolioDetailScreen.tsx",
    "src/app/screens/portfolio/PortfolioCreateScreen.tsx",
    "src/app/screens/portfolio/PortfolioEditScreen.tsx",
    "src/app/screens/portfolio/PortfolioItemPickerScreen.tsx",
    "src/app/screens/portfolio/PortfolioCollaboratorsScreen.tsx",
    "src/app/screens/portfolio/PortfolioSearchScreen.tsx",
    "src/app/screens/portfolio/PortfolioPublicViewScreen.tsx",
    "src/app/screens/portfolio/AdminPortfolioFlagsScreen.tsx",
  ].forEach((relativePath) => {
    assert.ok(fs.existsSync(path.join(repoRoot, relativePath)), `${relativePath} must exist`);
  });

  assert.match(rootNavigator, /name="PortfolioPublicView"/);
  assert.match(rootNavigator, /name="AdminPortfolioFlags"/);
  assert.match(linking, /PortfolioPublicView: "portfolio\/:portfolioId"/);
});

test("checklist and portfolio screens use reusable Phase 4 UI components", () => {
  [
    "src/components/checklist/ChecklistCard.tsx",
    "src/components/checklist/ChecklistItemRow.tsx",
    "src/components/portfolio/PortfolioCard.tsx",
    "src/components/portfolio/PortfolioItemRow.tsx",
    "src/components/portfolio/PortfolioTypeSelector.tsx",
    "src/components/portfolio/PortfolioVisibilitySelector.tsx",
    "src/components/portfolio/CollaboratorRow.tsx",
  ].forEach((relativePath) => {
    assert.ok(fs.existsSync(path.join(repoRoot, relativePath)), `${relativePath} must exist`);
  });

  assert.match(read("src/app/screens/checklist/ChecklistsHomeScreen.tsx"), /<ChecklistCard/);
  assert.match(read("src/app/screens/checklist/ChecklistDetailScreen.tsx"), /<ChecklistItemRow/);
  assert.match(read("src/app/screens/portfolio/PortfoliosHomeScreen.tsx"), /<PortfolioCard/);
  assert.match(read("src/app/screens/portfolio/PortfolioDetailScreen.tsx"), /<PortfolioItemRow/);
  assert.match(
    read("src/app/screens/portfolio/PortfolioCreateScreen.tsx"),
    /<PortfolioTypeSelector/,
  );
  assert.match(
    read("src/app/screens/portfolio/PortfolioCreateScreen.tsx"),
    /<PortfolioVisibilitySelector/,
  );
  assert.match(read("src/app/screens/portfolio/PortfolioEditScreen.tsx"), /<PortfolioTypeSelector/);
  assert.match(
    read("src/app/screens/portfolio/PortfolioEditScreen.tsx"),
    /<PortfolioVisibilitySelector/,
  );
  assert.match(
    read("src/app/screens/portfolio/PortfolioCollaboratorsScreen.tsx"),
    /<CollaboratorRow/,
  );
});

test("dish and stall detail screens expose checklist and portfolio entry points", () => {
  const detailActions = read("src/features/checklistPortfolio/DetailSaveActions.tsx");
  const saveToListOptions = read("src/features/checklistPortfolio/saveToListOptions.ts");
  const dishDetail = read("src/app/screens/detail/DishDetailScreenV2.tsx");
  const stallDetail = read("src/app/screens/detail/StallDetailScreen.tsx");
  const supabaseService = read("src/lib/services/supabase/supabaseService.ts");
  const migration = read("supabase/migrations/20260527103000_checklist_portfolio_passport.sql");

  assert.match(detailActions, /DEFAULT_CHECKLIST_NAME = "Want to Try"/);
  assert.match(saveToListOptions, /DEFAULT_PORTFOLIO_NAME = "Hungry Picks"/);
  assert.match(detailActions, /useChecklistStore\s*\n\s*\.getState\(\)\s*\n\s*\.addItem/);
  assert.match(detailActions, /usePortfolioStore\s*\n\s*\.getState\(\)\s*\n\s*\.addItem/);
  assert.doesNotMatch(
    detailActions,
    /trackAnalyticsEvent/,
    "detail buttons should rely on the checklist/portfolio stores for analytics to avoid duplicate events",
  );
  assert.match(detailActions, /checklistContainsTarget/);
  assert.match(detailActions, /findPortfolioTargetItem/);
  assert.match(detailActions, /navigation\.navigate\("AuthStack", \{ screen: "Login" \}\)/);

  assert.match(dishDetail, /useDetailSaveActions/);
  assert.match(dishDetail, /itemType: "dish"/);
  assert.match(dishDetail, /addToPortfolio/);

  assert.match(stallDetail, /useDetailSaveActions/);
  assert.match(stallDetail, /itemType: "stall"/);
  assert.match(stallDetail, /<DetailSaveActionsCard/);
  assert.match(stallDetail, /title="Save this stall"/);

  assert.match(supabaseService, /insert\(\{ user_id: userId, name \}\)/);
  assert.match(supabaseService, /insert\(\{\s+owner_id: userId/s);
  assert.match(supabaseService, /checklist_id: input\.checklistId/);
  assert.match(supabaseService, /item_type: input\.itemType/);
  assert.match(supabaseService, /return mapChecklistItem\(data as Row\)/);
  assert.match(supabaseService, /\.\.\.mapPortfolioItem\(row as unknown as Row\)/);
  // Quick save never falls back to another list and never invents a score.
  assert.doesNotMatch(detailActions, /score: 8/);
  assert.doesNotMatch(detailActions, /checklists\[0\]/);
  assert.doesNotMatch(
    detailActions,
    /portfolios\.find\(\(entry\) => entry\.ownerId === profile\.id\)/,
  );

  assert.match(migration, /function public\.add_portfolio_item_with_passport/);
  assert.match(migration, /set search_path = public/);
  assert.match(migration, /p\.owner_id = auth\.uid\(\)/);
  assert.match(migration, /pc\.user_id = auth\.uid\(\)/);
  assert.match(migration, /This item is already in the portfolio/);
});
