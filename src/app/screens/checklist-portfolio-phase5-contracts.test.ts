import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("Phase 5 checklist and portfolio stores centralize analytics and edge guards", () => {
  const analyticsTypes = read("src/lib/analytics/types.ts");
  const checklistStore = read("src/store/useChecklistStore.ts");
  const portfolioStore = read("src/store/usePortfolioStore.ts");
  const passportStore = read("src/store/usePassportStore.ts");

  [
    "checklist_created",
    "checklist_item_added",
    "checklist_item_tried",
    "portfolio_created",
    "portfolio_published",
    "portfolio_item_added",
    "portfolio_followed",
    "portfolio_flagged",
    "passport_stamp_earned",
  ].forEach((eventName) => {
    assert.match(analyticsTypes, new RegExp(`"${eventName}"`));
  });

  assert.match(checklistStore, /trackAnalyticsEvent\(\s*"checklist_created"/);
  assert.match(checklistStore, /trackAnalyticsEvent\(\s*"checklist_item_added"/);
  assert.match(checklistStore, /trackAnalyticsEvent\(\s*"checklist_item_tried"/);
  assert.match(checklistStore, /isSameChecklistTarget/);
  assert.match(checklistStore, /This item is already in the checklist/);
  assert.match(checklistStore, /assertCompleteReorder/);
  assert.match(checklistStore, /reorder requires every current item exactly once/);
  assert.match(checklistStore, /catch \(error\)[\s\S]*get\(\)\.items\[checklistId\]/);
  assert.match(checklistStore, /state\.items\[checklistId\] \?\? \[\]/);
  assert.match(checklistStore, /hungryPersistStorage/);
  assert.doesNotMatch(checklistStore, /@react-native-async-storage\/async-storage/);
  assert.match(
    checklistStore,
    /partialize: \(state\) => \(\{ checklists: state\.checklists, items: state\.items \}\)/,
  );

  assert.match(portfolioStore, /trackAnalyticsEvent\(\s*"portfolio_created"/);
  assert.match(portfolioStore, /trackAnalyticsEvent\(\s*"portfolio_published"/);
  assert.match(portfolioStore, /trackAnalyticsEvent\(\s*"portfolio_item_added"/);
  assert.match(portfolioStore, /trackAnalyticsEvent\(\s*"portfolio_followed"/);
  assert.match(portfolioStore, /trackAnalyticsEvent\(\s*"portfolio_flagged"/);
  assert.match(portfolioStore, /normalizeScore/);
  assert.match(portfolioStore, /Portfolio item score must be between 1 and 10/);
  assert.match(portfolioStore, /isSamePortfolioTarget/);
  assert.match(portfolioStore, /This item is already in the portfolio/);
  assert.match(portfolioStore, /assertCompleteReorder/);
  assert.match(portfolioStore, /reorder requires every current item exactly once/);
  assert.match(portfolioStore, /matchesPortfolioFilters/);
  assert.match(portfolioStore, /PortfolioEditConflict/);
  assert.match(portfolioStore, /mutatePortfolio/);
  assert.match(portfolioStore, /loadLatestAfterConflict/);
  assert.match(portfolioStore, /getPortfolioMutationOptions/);
  assert.match(portfolioStore, /expectedUpdatedAt: portfolio\?\.updatedAt/);
  assert.match(portfolioStore, /refreshPortfolio/);
  assert.match(portfolioStore, /clearConflict/);
  assert.match(portfolioStore, /This portfolio changed elsewhere/);
  assert.match(portfolioStore, /catch \(error\)[\s\S]*get\(\)\.items\[portfolioId\]/);
  assert.match(portfolioStore, /state\.items\[portfolioId\] \?\? \[\]/);
  assert.match(portfolioStore, /collaborators: state\.collaborators/);
  assert.match(portfolioStore, /follows: state\.follows/);
  assert.match(portfolioStore, /hungryPersistStorage/);
  assert.doesNotMatch(portfolioStore, /@react-native-async-storage\/async-storage/);

  assert.match(passportStore, /trackAnalyticsEvent\(\s*"passport_stamp_earned"/);
});

test("Phase 5 screens handle deleted references and invalid portfolio scores", () => {
  const checklistDetail = read("src/app/screens/checklist/ChecklistDetailScreen.tsx");
  const checklistItemPicker = read("src/app/screens/checklist/ChecklistItemPickerScreen.tsx");
  const checklistItemRow = read("src/components/checklist/ChecklistItemRow.tsx");
  const portfolioDetail = read("src/app/screens/portfolio/PortfolioDetailScreen.tsx");
  const portfolioItemPicker = read("src/app/screens/portfolio/PortfolioItemPickerScreen.tsx");
  const portfolioItemRow = read("src/components/portfolio/PortfolioItemRow.tsx");
  const detailActions = read("src/features/checklistPortfolio/DetailSaveActions.tsx");

  assert.match(checklistDetail, /Deleted dish/);
  assert.match(checklistDetail, /Deleted stall/);
  assert.match(checklistItemPicker, /ScheduleFields/);
  assert.match(checklistItemPicker, /parseDateOnly/);
  // Reminder field removed until notifications ship (decision 17).
  assert.doesNotMatch(checklistItemPicker, /parseReminderDateTime|reminderAt:|Remind me/);
  assert.match(checklistItemPicker, /plannedVisitDate: parseDateOnly/);
  assert.match(checklistItemRow, /formatDateOnly/);
  assert.doesNotMatch(checklistItemRow, /formatReminder|Reminder /);
  assert.match(checklistItemRow, /getScheduleLabel/);
  assert.match(checklistItemRow, /PanResponder\.create/);
  assert.match(checklistItemRow, /GripVertical/);
  assert.match(checklistItemRow, /accessibilityRole="adjustable"/);
  assert.match(checklistItemRow, /Drag to reorder checklist item/);
  assert.match(portfolioDetail, /Deleted dish/);
  assert.match(portfolioDetail, /Deleted stall/);
  assert.match(portfolioDetail, /Latest version loaded/);
  assert.match(portfolioDetail, /showListError/);
  assert.match(portfolioItemRow, /PanResponder\.create/);
  assert.match(portfolioItemRow, /GripVertical/);
  assert.match(portfolioItemRow, /accessibilityRole="adjustable"/);
  assert.match(portfolioItemRow, /Drag to reorder list item/);

  const portfolioItemEditSheet = read("src/components/portfolio/PortfolioItemEditSheet.tsx");
  const listItemScore = read("src/features/checklistPortfolio/listItemScore.ts");
  assert.match(portfolioItemEditSheet, /parseListItemScore/);
  assert.match(listItemScore, /Use a whole number from 1 to 10\./);
  assert.match(portfolioItemPicker, /Latest version loaded/);
  assert.match(portfolioItemPicker, /disabled=\{!canAddItem\}/);

  assert.doesNotMatch(
    detailActions,
    /trackAnalyticsEvent/,
    "detail save actions should not double count analytics outside the stores",
  );
});

test("Phase 5 migration matches the live schema and hardens RPCs", () => {
  const migration = read("supabase/migrations/20260527103000_checklist_portfolio_passport.sql");
  const grantFix = read(
    "supabase/migrations/20260527104500_checklist_portfolio_passport_grant_fix.sql",
  );

  assert.doesNotMatch(migration, /public\.stalls/);
  assert.doesNotMatch(migration, /auth\.users/);
  assert.doesNotMatch(migration, /public\.profiles|profiles\.role/);
  assert.doesNotMatch(migration, /user_follows/);
  assert.doesNotMatch(
    migration,
    /category_id uuid|reference_id uuid|p_dish_id uuid|p_stall_id uuid/,
  );

  assert.match(migration, /dish_id text references public\.dishes\(id\)/);
  assert.match(migration, /stall_id text references public\.venues\(id\)/);
  assert.match(migration, /create table if not exists public\.passport_stamps/);
  assert.match(migration, /category_id text not null/);
  assert.match(migration, /reference_id text/);
  assert.match(migration, /idx_portfolios_name_description_trgm/);
  assert.match(migration, /idx_checklist_items_unique_dish/);
  assert.match(migration, /idx_checklist_items_unique_stall/);
  assert.match(migration, /idx_portfolio_items_unique_dish/);
  assert.match(migration, /idx_portfolio_items_unique_stall/);
  assert.match(migration, /idx_portfolio_flags_unique_pending/);
  assert.match(migration, /enforce_portfolio_creation_rate_limit/);
  assert.match(migration, /Portfolio creation rate limit exceeded/);
  assert.match(migration, /enforce_portfolio_flag_rate_limit/);
  assert.match(migration, /Portfolio flag rate limit exceeded/);
  assert.match(
    migration,
    /similarity\(lower\(p\.name \|\| ' ' \|\| coalesce\(p\.description, ''\)\), lower\(p_query\)\)/,
  );
  assert.match(migration, /from public\.follows/);
  assert.match(migration, /public\.app_is_current_user_ops_admin\(\)/);

  [
    "record_passport_progress",
    "add_portfolio_item_with_passport",
    "publish_portfolio_with_passport",
    "reorder_checklist_items",
    "reorder_portfolio_items",
    "search_portfolios",
  ].forEach((functionName) => {
    assert.match(
      migration,
      new RegExp(`function public\\.${functionName}[\\s\\S]*?set search_path = public`),
      `${functionName} must pin search_path`,
    );
  });

  assert.match(migration, /Authentication required/);
  assert.match(migration, /Portfolio not found or not editable/);
  assert.match(migration, /assert_portfolio_expected_updated_at/);
  assert.match(migration, /p_expected_portfolio_updated_at timestamptz default null/);
  assert.match(migration, /This portfolio changed elsewhere/);
  assert.match(migration, /update_portfolio_item_with_version/);
  assert.match(migration, /delete_portfolio_item_with_version/);
  assert.match(migration, /Checklist reorder requires every current item exactly once/);
  assert.match(migration, /Portfolio reorder requires every current item exactly once/);
  assert.match(migration, /grant execute on function public\.add_portfolio_item_with_passport/);
  assert.match(migration, /revoke all on function public\.record_passport_progress/);
  assert.match(
    migration,
    /grant select, update, delete on table public\.portfolio_items to authenticated/,
  );
  assert.doesNotMatch(
    migration,
    /grant select, insert, update, delete on table public\.portfolio_items to authenticated/,
  );
  assert.match(
    migration,
    /grant select on table public\.passport_progress_events to authenticated/,
  );
  assert.match(
    grantFix,
    /revoke insert on table public\.portfolio_items from public, anon, authenticated/,
  );
  assert.match(
    grantFix,
    /revoke insert, update, delete on table public\.passport_progress_events from public, anon, authenticated/,
  );
  assert.match(grantFix, /grant select, update, delete on table public\.portfolio_items/);
  assert.match(grantFix, /grant select on table public\.passport_progress_events/);
});

test("Phase 5 Supabase service scopes portfolio follow status to the signed-in user", () => {
  const supabaseService = read("src/lib/services/supabase/supabaseService.ts");
  const serviceTypes = read("src/lib/services/types.ts");

  assert.match(serviceTypes, /interface PortfolioMutationOptions/);
  assert.match(serviceTypes, /expectedUpdatedAt\?: string/);
  assert.match(supabaseService, /portfolioEditConflictError/);
  assert.match(supabaseService, /p_expected_portfolio_updated_at: options\?\.expectedUpdatedAt/);
  assert.match(supabaseService, /rpc\("update_portfolio_item_with_version"/);
  assert.match(supabaseService, /rpc\("delete_portfolio_item_with_version"/);

  assert.match(
    supabaseService,
    /upsert\(\s*\{ portfolio_id: portfolioId, user_id: userId \}/,
    "follow writes should be idempotent for the signed-in user",
  );
  assert.match(
    supabaseService,
    /delete\(\)[\s\S]*\.eq\("portfolio_id", portfolioId\)[\s\S]*\.eq\("user_id", userId\)/,
    "unfollow should not delete other users' follows",
  );
  assert.match(
    supabaseService,
    /select\("id"\)[\s\S]*\.eq\("portfolio_id", portfolioId\)[\s\S]*\.eq\("user_id", userId\)[\s\S]*\.maybeSingle\(\)/,
    "follow status should not be true because another user follows the portfolio",
  );
});

test("Phase 5 has a Supabase smoke check for checklist portfolio passport controls", () => {
  const smoke = read("supabase/smoke/checklist_portfolio_passport.sql");

  assert.match(smoke, /checklists/);
  assert.match(smoke, /portfolio_items/);
  assert.match(smoke, /passport_progress_events/);
  assert.match(smoke, /idx_checklist_items_unique_dish/);
  assert.match(smoke, /idx_portfolio_items_unique_dish/);
  assert.match(smoke, /idx_portfolio_flags_unique_pending/);
  assert.match(
    smoke,
    /has_table_privilege\('authenticated', 'public\.portfolio_items', 'INSERT'\)/,
  );
  assert.match(
    smoke,
    /has_table_privilege\('authenticated', 'public\.passport_progress_events', 'INSERT'\)/,
  );
  assert.match(smoke, /similarity\(lower\(p\.name/);
});

test("Phase 5 documentation covers user, admin, and service usage", () => {
  const guide = read("tasks/Roadmap/Gamification/checklist-portfolio-passport-guide.md");

  assert.match(guide, /User Guide: Checklists/);
  assert.match(guide, /User Guide: Portfolios/);
  assert.match(guide, /Admin Guide: Portfolio Moderation/);
  assert.match(guide, /Service\/API Reference/);
  assert.match(guide, /Offline behavior/);
  assert.match(guide, /supabase\/smoke\/checklist_portfolio_passport\.sql/);
  assert.match(guide, /portfolio_items` direct authenticated insert is revoked/);
  assert.match(guide, /security-definer functions pin `search_path = public`/);
});
