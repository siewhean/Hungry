import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { dishes } from "@/lib/services/mock/data";
import { hungryService } from "@/lib/services/mock/mockService";
import { dishMatchesSearchCategory } from "@/lib/services/searchCategoryMatch";

function read(pathFromRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

test("H20: listUserPosts pages one author's posts on the server", async () => {
  const supabaseService = read("src/lib/services/supabase/supabaseService.ts");
  assert.match(supabaseService, /authorId: userId,\s*offset: page\?\.offset \?\? 0/);
  assert.match(supabaseService, /\.range\(offset, offset \+ limit - 1\)/);
  assert.match(
    read("supabase/migrations/20261019110000_user_posts_author_index.sql"),
    /on public\.posts \(author_id, published_at desc, created_at desc\)/,
  );
  assert.match(read("src/features/profile/exportMyData.ts"), /listUserPosts\(userId, page\)/);

  const authorId = (await hungryService.social.getBitesFeed())[0]?.authorId;
  assert.ok(authorId);
  const firstPage = await hungryService.social.listUserPosts(authorId, { limit: 1, offset: 0 });
  assert.equal(firstPage.length, 1);
  assert.ok(firstPage.every((bite) => bite.authorId === authorId));

  // The own grid pages too, and a failed server read keeps the locally shared posts.
  const profileHome = read("src/app/screens/profile/ProfileHomeScreen.tsx");
  assert.match(
    profileHome,
    /listUserPosts\(profile\.id, \{ limit: OWN_POSTS_PAGE_SIZE, offset \}\)/,
  );
  assert.match(profileHome, /onPress=\{loadMoreProfilePosts\}/);
  assert.match(profileHome, /loadOwnPostsPage\(0\)\.catch\(/);
  assert.match(profileHome, /title="Couldn't load posts"/);
});

test("H22: another user's Reviews tab lists only that account's reviews", async () => {
  const content = read("src/app/screens/profile/UserProfileContent.tsx");
  assert.match(content, /reviews\.getUserReviews\(normalizedAuthorId\)/);
  assert.doesNotMatch(content, /commentsByPostId/);
  assert.match(content, /title="Couldn't load reviews"/);
  assert.match(
    read("src/lib/services/supabase/supabaseService.ts"),
    /async getUserReviews\(userId\) \{[\s\S]*?if \(error\) throw error;/,
  );
  const otherUserId = "batch-b-other-user";
  const reviews = await hungryService.reviews.getUserReviews(otherUserId);
  assert.ok(reviews.every((review) => review.authorId === otherUserId));
});

test("H23/H24/H28: other profiles render directly and open connection lists on the root stack", () => {
  const screen = read("src/app/screens/profile/UserProfileScreen.tsx");
  const content = read("src/app/screens/profile/UserProfileContent.tsx");
  const root = read("src/app/navigation/RootNavigator.tsx");
  const types = read("src/app/navigation/navigationTypes.ts");
  const connections = read("src/app/screens/profile/ProfileConnectionsScreen.tsx");

  assert.match(screen, /<UserProfileContent/);
  assert.doesNotMatch(screen, /<ProfileHomeScreen/);
  assert.match(types, /UserFollowers: \{ userId: string; userDisplayName\?: string \}/);
  assert.match(root, /name="UserFollowers"/);
  assert.match(root, /name="UserFollowing"/);
  assert.match(content, /openProfileConnections\("UserFollowers"\)/);
  assert.doesNotMatch(content, /navigate\("VisitedStalls"\)/);
  assert.match(connections, /route\.name === "UserFollowing"/);
});

test("H21/H24: every navigate to UserProfile passes an account id", () => {
  for (const file of [
    "src/components/stall/PopularVisitorsSection.tsx",
    "src/app/screens/home/HomeFeedScreen.tsx",
    "src/app/screens/profile/ProfileConnectionsScreen.tsx",
    "src/app/screens/profile/FollowRequestsScreen.tsx",
  ]) {
    const calls = read(file)
      .split(/navigate\("UserProfile", \{/)
      .slice(1);
    assert.ok(calls.length > 0, file);
    for (const call of calls) {
      assert.match(call.split("})")[0], /authorId:/, file);
    }
  }
  assert.match(
    read("src/components/stall/PopularVisitorsSection.tsx"),
    /authorId: pin\.authorProfileId/,
  );
});

test("H25: follow list reads throw and the screen shows an error with Retry", () => {
  const supabaseService = read("src/lib/services/supabase/supabaseService.ts");
  const connections = read("src/app/screens/profile/ProfileConnectionsScreen.tsx");
  assert.equal(
    supabaseService.match(
      /\/\/ Thrown so screens can tell a failed read from an empty list\.\n\s*if \(error\) throw error;/g,
    )?.length,
    2,
  );
  assert.match(connections, /setLoadFailed\(true\)/);
  assert.match(connections, /label="Retry"/);
});

test("H27: passport celebration is marked at start and persisted per user", () => {
  const screen = read("src/app/screens/profile/PassportScreen.tsx");
  const store = read("src/store/usePassportStore.ts");
  assert.match(
    screen,
    /markStampCelebrated\(celebrateMarker\.stampId\);\s*setCelebratingStampId\(celebrateMarker\.stampId\);/,
  );
  assert.doesNotMatch(screen, /celebratingStampId === celebrateMarker\.stampId/);
  assert.match(store, /name: "passport-celebrations-v1"/);
  assert.match(store, /reportedEarnedStampIds: Record<string, boolean>/);
  assert.match(store, /\.\.\.Object\.keys\(get\(\)\.reportedEarnedStampIds\)/);
  assert.match(store, /const ensureOwner = \(\) =>/);
  // Nothing is reported or celebrated before the persisted ids have loaded.
  assert.match(store, /if \(!usePassportStore\.persist\.hasHydrated\(\)\) \{/);
  assert.match(screen, /if \(!passportHydrated \|\| !celebrateMarker\?\.shouldCelebrate\) return;/);
});

test("H29: other-profile stats, tabs and post actions have labels", () => {
  const content = read("src/app/screens/profile/UserProfileContent.tsx");
  const post = read("src/app/screens/profile/SocialPostDetailScreen.tsx");
  assert.match(
    content,
    /accessibilityLabel=\{value === null \? `\$\{label\}, loading` : `\$\{value\} \$\{label\}`\}/,
  );
  assert.match(content, /accessibilityRole="tab"/);
  assert.match(post, /accessibilityLabel=\{`Like, \$\{interaction\.likeCount\}/);
  assert.match(post, /accessibilityLabel=\{`Save, \$\{interaction\.saveCount\}/);
  assert.match(post, /accessibilityLabel=\{`Share, \$\{interaction\.shareCount\}/);
  assert.match(post, /accessibilityLabel=\{`Comments, \$\{interaction\.commentCount\}/);
});

test("H30: private notes are column-guarded and served only to owner and collaborators", async () => {
  const migration = read("supabase/migrations/20261019111000_portfolio_private_notes_guard.sql");
  const supabaseService = read("src/lib/services/supabase/supabaseService.ts");
  assert.match(
    migration,
    /revoke select on table public\.portfolio_items from public, anon, authenticated;/,
  );
  assert.doesNotMatch(migration.split("grant select (")[1].split(")")[0], /private_notes/);
  assert.match(migration, /function public\.get_portfolio_private_notes[\s\S]*security invoker/);
  assert.doesNotMatch(supabaseService, /from\("portfolio_items"\)\s*\.select\("\*"\)/);
  assert.match(supabaseService, /client\.rpc\("get_portfolio_private_notes"/);

  const portfolio = await hungryService.portfolio.createPortfolio({
    name: "Batch B notes",
    type: "recommendation",
    visibility: "public",
  });
  await hungryService.portfolio.addPortfolioItem({
    portfolioId: portfolio.id,
    itemType: "dish",
    dishId: dishes[2].id,
    privateNotes: "only me",
  });
  const ownItems = await hungryService.portfolio.getPortfolioItems(portfolio.id);
  assert.equal(ownItems[0]?.privateNotes, "only me");
});

test("H31: checklist and portfolio caches are cleared with the account", () => {
  const session = read("src/store/useSessionStore.ts");
  assert.match(session, /useChecklistStore\.getState\(\)\._reset\(\);/);
  assert.match(session, /usePortfolioStore\.getState\(\)\._reset\(\);/);
});

test("H32/H33/H34: list screens avoid render loops, show load errors and report write failures", () => {
  const checklistDetail = read("src/app/screens/checklist/ChecklistDetailScreen.tsx");
  const portfolioDetail = read("src/app/screens/portfolio/PortfolioDetailScreen.tsx");
  for (const source of [checklistDetail, portfolioDetail]) {
    assert.match(source, /useItemLabels\(/);
    assert.doesNotMatch(source, /items\[(checklistId|portfolioId)\] \?\? \[\]/);
  }
  assert.match(read("src/app/screens/checklist/ChecklistsHomeScreen.tsx"), /label="Retry"/);
  assert.match(read("src/app/screens/portfolio/PortfoliosHomeScreen.tsx"), /label="Retry"/);
  assert.match(checklistDetail, /runListMutation\(\(\) => markItemTried\(item\.id\)/);
  assert.match(portfolioDetail, /portfolio\.visibility === "public" \? \(/);
  assert.match(
    read("src/app/screens/checklist/ChecklistItemPickerScreen.tsx"),
    /if \(added\) navigation\.goBack\(\);/,
  );
});

test("H36: collaborators can no longer be added by pasting a raw user id", () => {
  const screen = read("src/app/screens/portfolio/PortfolioCollaboratorsScreen.tsx");
  assert.doesNotMatch(screen, /Paste a Hungry user id/);
  assert.match(screen, /Inviting collaborators isn't available yet/);
});

test("H37: wheel Browse tab matches the catalog's dish names and tags", () => {
  const sheet = read("src/app/screens/wheel/WheelEntryAddSheet.tsx");
  assert.match(sheet, /label: "Browse"/);
  assert.doesNotMatch(sheet, /label: "Crave"/);
  assert.ok(
    dishMatchesSearchCategory({ name: "Beef Noodle Soup", tasteTags: ["Savoury"] }, "noodles"),
  );
  assert.ok(
    dishMatchesSearchCategory({ name: "Chicken Rice", tasteTags: ["Local"] }, "local favourites"),
  );
  assert.ok(
    dishMatchesSearchCategory(
      { name: "Chendol", tasteTags: [], foodTypeTag: "Dessert" },
      "desserts",
    ),
  );
  assert.ok(!dishMatchesSearchCategory({ name: "Laksa", tasteTags: ["Spicy"] }, "rice"));
  // Whole words only: "late" is not "plate" or "chocolate", "rice" is not "price".
  assert.ok(
    !dishMatchesSearchCategory({ name: "Chicken Rice Plate", tasteTags: [] }, "late night"),
  );
  assert.ok(!dishMatchesSearchCategory({ name: "Chocolate Cake", tasteTags: [] }, "late night"));
  assert.ok(!dishMatchesSearchCategory({ name: "Fixed Price Set", tasteTags: [] }, "rice"));
  assert.ok(dishMatchesSearchCategory({ name: "Late Night Supper", tasteTags: [] }, "late night"));
});

test("H38: wheel sheet looks up each venue's dishes once and repositories index by venue", () => {
  const sheet = read("src/app/screens/wheel/WheelEntryAddSheet.tsx");
  const repository = read("src/lib/services/supabase/supabaseRepository.ts");
  assert.match(sheet, /useDeferredValue\(query\)/);
  assert.match(sheet, /if \(!visible\) return \[\];/);
  assert.doesNotMatch(sheet, /function VenueRow[\s\S]*getDataRepository\(\)[\s\S]*export function/);
  assert.match(repository, /getDishesByVenueIndex\(\)\.get\(venueId\)/);
});

test("H39: removing a reported list unpublishes it", async () => {
  const migration = read("supabase/migrations/20261019112000_resolve_portfolio_flag_unpublish.sql");
  assert.match(migration, /set visibility = 'private',\s*published_at = null/);
  assert.match(migration, /app_is_current_user_ops_admin\(\)/);
  assert.match(
    read("src/lib/services/supabase/supabaseService.ts"),
    /client\.rpc\("resolve_portfolio_flag"/,
  );

  const portfolio = await hungryService.portfolio.createPortfolio({
    name: "Batch B flagged",
    type: "recommendation",
    visibility: "public",
  });
  await hungryService.portfolio.publishPortfolio(portfolio.id);
  await hungryService.portfolio.flagPortfolio(portfolio.id, "spam");
  const flag = (await hungryService.portfolio.getPortfolioFlags({ status: "pending" })).find(
    (entry) => entry.portfolioId === portfolio.id,
  );
  assert.ok(flag);
  await hungryService.portfolio.resolvePortfolioFlag(flag.id, "removed");
  const removed = await hungryService.portfolio.getPortfolio(portfolio.id);
  assert.equal(removed.visibility, "private");
  assert.equal(removed.publishedAt, undefined);

  // The owner cannot undo the takedown.
  await assert.rejects(hungryService.portfolio.publishPortfolio(portfolio.id));
  await assert.rejects(
    hungryService.portfolio.updatePortfolio(portfolio.id, { visibility: "public" }),
  );
  const lock = read("supabase/migrations/20261019113000_portfolio_moderation_lock.sql");
  assert.match(lock, /add column if not exists moderation_removed_at timestamptz/);
  assert.match(lock, /moderation_removed_at = now\(\)/);
  assert.match(lock, /before update on public\.portfolios/);
});
