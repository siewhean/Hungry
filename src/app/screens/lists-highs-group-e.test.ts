import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  canShowMorePickerResults,
  nextPickerLimit,
  PICKER_MAX_RESULTS,
  PICKER_PAGE_SIZE,
  searchPickerVenues,
} from "@/features/checklistPortfolio/pickerSearch";
import {
  buildSaveToListOptions,
  DEFAULT_PORTFOLIO_NAME,
} from "@/features/checklistPortfolio/saveToListOptions";
import { getHungryService, setMockServiceProvider } from "@/lib/services/serviceProvider";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useProfileStore } from "@/store/useProfileStore";
import type { Portfolio } from "@/types/domain";

function read(pathFromRepoRoot: string) {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

test("H40: the newest portfolio_items SELECT grant to authenticated is column-scoped without private_notes", () => {
  const dir = "supabase/migrations";
  const files = readdirSync(resolve(process.cwd(), dir))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  let lastGrant: { file: string; statement: string } | null = null;
  for (const file of files) {
    const sql = read(`${dir}/${file}`).replace(/--.*$/gm, "");
    for (const statement of sql.split(";")) {
      if (
        /grant\s+select\b[\s\S]*\bon\s+table\s+public\.portfolio_items\s+to\s+[^;]*\bauthenticated\b/i.test(
          statement,
        )
      ) {
        lastGrant = { file, statement };
      }
    }
  }
  assert.ok(lastGrant, "expected a portfolio_items SELECT grant");
  assert.match(
    lastGrant.statement,
    /grant\s+select\s*\(/i,
    `${lastGrant.file} grants table-wide SELECT`,
  );
  assert.doesNotMatch(lastGrant.statement, /private_notes/);
  assert.match(
    read(`${dir}/${lastGrant.file}`),
    /revoke select on table public\.portfolio_items from public, anon, authenticated/,
  );
  assert.match(
    read("supabase/smoke/portfolio_items_restore_private_notes_column_guard.sql"),
    /has_column_privilege\('authenticated', 'public\.portfolio_items', 'private_notes', 'select'\)/,
  );
});

test("H42: each Lists tab loads its own server query and a capped read never drops cached lists", async () => {
  setMockServiceProvider();
  usePortfolioStore.getState()._reset();
  const service = getHungryService();
  const me = await service.profile.getProfile();
  useProfileStore.setState({ profile: me });

  const mine = await service.portfolio.createPortfolio({
    name: "Group E mine",
    type: "ranking",
    visibility: "private",
  });
  await usePortfolioStore.getState().loadPortfolioScope("mine");
  assert.ok(usePortfolioStore.getState().scopeIds.mine?.includes(mine.id));

  // A narrower read merges instead of replacing the cache (the old load replaced it).
  await usePortfolioStore.getState().loadPortfolios({ type: "trail" });
  assert.ok(usePortfolioStore.getState().portfolios.some((entry) => entry.id === mine.id));

  await usePortfolioStore.getState().loadPortfolioScope("discover");
  assert.ok(!usePortfolioStore.getState().scopeIds.discover?.includes(mine.id));

  const home = read("src/app/screens/portfolio/PortfoliosHomeScreen.tsx");
  assert.match(home, /loadPortfolioScope\(activeTab\)/);
  assert.doesNotMatch(home, /portfolio\.ownerId !== profile\.id/);
  const favourites = read("src/app/screens/profile/FavouritesScreen.tsx");
  assert.match(favourites, /loadPortfolioScope\("mine"\)/);
  assert.doesNotMatch(favourites, /loadPortfolios\(\)/);
  const edit = read("src/app/screens/portfolio/PortfolioEditScreen.tsx");
  assert.match(edit, /refreshPortfolio\(portfolioId\)/);
  assert.doesNotMatch(edit, /loadPortfolios\(\)/);
  const supabaseService = read("src/lib/services/supabase/supabaseService.ts");
  assert.match(supabaseService, /query = query\.in\("id", filters\.ids\)/);
  const store = read("src/store/usePortfolioStore.ts");
  assert.match(store, /getPortfolios\(\{ userId: profileId \}\)/);
  assert.match(store, /getFollowedPortfolioIds\(\)/);
  assert.match(store, /searchPortfolios\("", \{ visibility: "public" \}\)/);
});

test("H41: editors get item controls and shared lists have their own tab", async () => {
  const detail = read("src/app/screens/portfolio/PortfolioDetailScreen.tsx");
  assert.match(detail, /const canEdit = isOwner \|\| myRole === "editor";/);
  assert.match(detail, /loadPortfolioCollaborators\(portfolioId\)/);
  assert.match(detail, /\{canEdit \? \(\s*<Button\s*label="Add"/);
  assert.match(detail, /canEdit=\{canEdit\}/);
  // Publish and the More menu (Edit, Collaborators, Delete) stay owner-only.
  assert.match(
    detail,
    /\{isOwner \? \(\s*<>\s*<Button\s*label=\{isLive \? "Unpublish" : "Publish"\}/,
  );
  assert.match(
    read("src/components/portfolio/PortfolioItemRow.tsx"),
    /\{canEdit \? \(\s*<View style=\{styles\.actionRow\}>/,
  );
  assert.match(
    read("src/app/screens/portfolio/PortfoliosHomeScreen.tsx"),
    /shared: "Shared with me"/,
  );

  setMockServiceProvider();
  const service = getHungryService();
  const list = await service.portfolio.createPortfolio({
    name: "Group E shared",
    type: "collection",
    visibility: "private",
  });
  assert.ok(!(await service.portfolio.getSharedPortfolioIds()).includes(list.id));
  const viaIds = await service.portfolio.getPortfolios({ ids: [list.id] });
  assert.deepEqual(
    viaIds.map((entry) => entry.id),
    [list.id],
  );
  assert.deepEqual(await service.portfolio.getPortfolios({ ids: [] }), []);
});

test("H43: Save to list offers Hungry Picks first, your lists, then editable shared lists", () => {
  const base = {
    type: "recommendation" as const,
    visibility: "private" as const,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  };
  const portfolios: Portfolio[] = [
    { ...base, id: "p-laksa", ownerId: "me", name: "Best laksa ranking" },
    { ...base, id: "p-shared", ownerId: "friend", name: "Friend's trail" },
    { ...base, id: "p-other", ownerId: "friend", name: "Not shared" },
  ];

  const withoutDefault = buildSaveToListOptions(portfolios, ["p-laksa"], ["p-shared"], "me");
  assert.deepEqual(
    withoutDefault.map((option) => [option.key, option.name, option.isShared]),
    [
      ["default", DEFAULT_PORTFOLIO_NAME, false],
      ["p-laksa", "Best laksa ranking", false],
      ["p-shared", "Friend's trail", true],
    ],
  );

  const withDefault = buildSaveToListOptions(
    [...portfolios, { ...base, id: "p-picks", ownerId: "me", name: DEFAULT_PORTFOLIO_NAME }],
    ["p-laksa", "p-picks"],
    [],
    "me",
  );
  assert.deepEqual(
    withDefault.map((option) => option.key),
    ["p-picks", "p-laksa"],
  );

  const actions = read("src/features/checklistPortfolio/DetailSaveActions.tsx");
  assert.match(actions, /listSheetRef\.current\?\.present\(\)/);
  assert.match(actions, /getSharedPortfolioIds\(\{ role: "editor" \}\)/);
  assert.match(actions, /label="Create and add"/);
  assert.match(actions, /accessibilityRole="checkbox"/);
  assert.match(read("src/app/screens/detail/DishDetailScreenV2.tsx"), /\{saveToListSheet\}/);
  assert.match(
    read("src/app/screens/detail/StallDetailScreen.tsx"),
    /\{detailSaveActions\.saveToListSheet\}/,
  );
});

test("H44: list pickers search stalls across the whole catalog", async () => {
  for (const path of [
    "src/app/screens/portfolio/PortfolioItemPickerScreen.tsx",
    "src/app/screens/checklist/ChecklistItemPickerScreen.tsx",
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /listBuildings\(\)/, path);
    assert.doesNotMatch(source, /\.slice\(0, 6\)/, path);
    assert.match(source, /searchPickerVenues\(query,/, path);
  }
  assert.match(
    read("src/app/screens/portfolio/PortfolioItemPickerScreen.tsx"),
    /label="Show more"/,
  );

  setMockServiceProvider();
  const service = getHungryService();
  const buildings = await service.discovery.listBuildings();
  const laterBuilding = buildings[6];
  if (laterBuilding) {
    const venue = (await service.discovery.listVenuesByBuilding(laterBuilding.id))[0];
    if (venue) {
      const found = await searchPickerVenues(venue.name, PICKER_PAGE_SIZE);
      assert.ok(found.some((entry) => entry.id === venue.id));
    }
  }
  assert.equal(nextPickerLimit(PICKER_PAGE_SIZE), PICKER_PAGE_SIZE * 2);
  assert.equal(nextPickerLimit(PICKER_MAX_RESULTS), PICKER_MAX_RESULTS);
  assert.equal(canShowMorePickerResults(PICKER_PAGE_SIZE, PICKER_PAGE_SIZE), true);
  assert.equal(canShowMorePickerResults(5, PICKER_PAGE_SIZE), false);
  assert.equal(canShowMorePickerResults(PICKER_MAX_RESULTS, PICKER_MAX_RESULTS), false);
});

test("H45: list rows open the dish or stall and show a photo, stall and rank", () => {
  const row = read("src/components/portfolio/PortfolioItemRow.tsx");
  assert.match(row, /onPress=\{onOpen\}/);
  assert.match(row, /accessibilityLabel=\{`Open \$\{label\}`\}/);
  assert.match(row, /<AccessibleImage/);
  assert.match(row, /<NoDishPhoto/);
  assert.match(row, /showRank \? `#\$\{index \+ 1\} \$\{label\}` : label/);
  assert.match(row, /detail\?\.stallName/);

  const detail = read("src/app/screens/portfolio/PortfolioDetailScreen.tsx");
  assert.match(
    detail,
    /rootNavigation\.navigate\("DishDetail", \{\s*dishId: item\.dishId,\s*source: "collection",?\s*\}\)/,
  );
  assert.match(detail, /rootNavigation\.navigate\("StallDetail", \{ venueId: item\.stallId \}\)/);
  assert.match(detail, /showRank=\{portfolio\.type === "ranking"\}/);
  assert.match(detail, /useItemDetailsState\(portfolioItems, portfolioId\)/);
});
