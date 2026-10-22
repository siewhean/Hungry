import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { resolveFeatureFlags } from "@/constants/featureFlags";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("full project audit P0: production feature flags and floorplan gating match launch posture", () => {
  const flags = resolveFeatureFlags("production");
  const rootNavigator = read("src/app/navigation/RootNavigator.tsx");
  const mapZoom = read("src/app/screens/discover/MapZoomedInScreen.tsx");
  const developerLauncher = read("src/app/screens/dev/DeveloperLauncherScreen.tsx");

  assert.equal(flags.directMessagesEnabled, false);
  assert.equal(flags.gamificationEnabled, false);
  assert.equal(flags.collectionsEnabled, false);
  assert.equal(flags.storiesEnabled, false);
  assert.equal(flags.commentsEnabled, false);
  assert.equal(flags.merchantCentreEnabled, false);
  assert.equal(flags.merchantClaimCtaEnabled, false);
  assert.equal(flags.oauthProvidersEnabled, false);
  assert.equal(flags.floorplansEnabled, false);

  // Floorplan screens were removed while the flag is hard-off; nothing routes to them.
  for (const source of [rootNavigator, mapZoom, developerLauncher]) {
    assert.doesNotMatch(source, /BuildingDrillDown|VenueDirectory/);
  }
});

test("full project audit P0: social safety, public profiles, and chat sends are backend-gated", () => {
  const socialSafety = read("supabase/migrations/0041_full_audit_social_safety.sql");
  const publicProfiles = read(
    "supabase/migrations/20260522124728_security_advisor_rls_view_fixes.sql",
  );
  const anonGrantFix = read(
    "supabase/migrations/20260522132749_advisor_public_profile_anon_grant_fix.sql",
  );
  const service = read("src/lib/services/supabase/supabaseService.ts");
  const readinessSmoke = read("supabase/smoke/full_audit_v1_readiness.sql");

  assert.match(socialSafety, /create or replace function public\.report_content/i);
  assert.match(socialSafety, /create or replace function public\.list_content_moderation_queue/i);
  assert.match(socialSafety, /public\.app_is_current_user_ops_admin\(\)/i);
  assert.match(socialSafety, /create or replace function public\.send_chat_message/i);
  assert.match(socialSafety, /app_user_block_exists\(v_user_id, cp\.participant_user_id\)/i);
  assert.match(socialSafety, /chat_message_minute[\s\S]*30/i);
  assert.match(socialSafety, /chat_message_hour[\s\S]*120/i);
  assert.match(
    socialSafety,
    /revoke insert, update, delete on table messages from anon, authenticated/i,
  );
  assert.match(
    socialSafety,
    /revoke insert, update, delete on table content_reports from anon, authenticated/i,
  );
  assert.match(service, /\.rpc\("send_chat_message"/);
  assert.doesNotMatch(service, /\.from\("messages"\)\s*\.insert\(\{/);

  assert.match(publicProfiles, /create table if not exists public\.public_profiles/i);
  assert.match(publicProfiles, /alter table public\.public_profiles enable row level security/i);
  assert.match(publicProfiles, /grant select on public\.public_profiles to anon, authenticated/i);
  assert.match(publicProfiles, /create policy public_profiles_select_visible/i);
  assert.match(
    anonGrantFix,
    /grant execute on function public\.can_read_author_content\(uuid\) to anon/i,
  );

  assert.match(readinessSmoke, /send_chat_message/);
  assert.match(readinessSmoke, /report_content/);
  assert.match(readinessSmoke, /list_content_moderation_queue/);
});

test("full project audit P1: repo hygiene and passport asset caps are guarded", () => {
  const merchantTabs = read("src/app/navigation/MerchantTabs.tsx");
  const gitignore = read(".gitignore");
  const readme = read("README.md");
  const generator = read("scripts/generate-passport-assets.mjs");

  assert.doesNotMatch(merchantTabs, /\bany\b/);
  assert.match(gitignore, /^node_modules\/$/m);
  assert.match(gitignore, /^dist\/$/m);
  assert.match(gitignore, /^graphify-out\/$/m);
  assert.doesNotMatch(readme, /frontend-only, mock data only/i);
  assert.match(generator, /resizeToMaxWidth/);
  assert.match(generator, /passport-cover-orange\.png", 280/);
  assert.match(generator, /passport-paper-spread\.png", 280/);

  for (const relativePath of [
    "test-geocode.ts",
    "test_jwt.js",
    "test_service_role.ts",
    "test_trigger.ts",
    "testResults_20260417_141538.json",
  ]) {
    assert.equal(
      existsSync(path.join(root, relativePath)),
      false,
      `${relativePath} should not ship`,
    );
  }

  for (const relativePath of [
    "src/assets/gamification/passport/passport-cover-orange.png",
    "src/assets/gamification/passport/passport-paper-spread.png",
    "src/assets/gamification/passport/stamp-cuisine-hawker.png",
    "src/assets/gamification/passport/stamp-classic-laksa.png",
    "src/assets/gamification/passport/stamp-hood-chinatown.png",
    "src/assets/gamification/passport/stamp-dietary-halal.png",
    "src/assets/gamification/passport/badge-hawker-explorer.png",
    "src/assets/gamification/passport/badge-classics-trail.png",
    "src/assets/gamification/passport/badge-night-makan.png",
    "src/assets/gamification/passport/badge-contributor.png",
  ]) {
    assert.ok(
      statSync(path.join(root, relativePath)).size < 100_000,
      `${relativePath} is too large`,
    );
  }
});

test("full project audit P1: numeric trust surfaces disclose live or preview data source", () => {
  const disclosure = read("src/lib/services/dataTrustDisclosure.ts");
  const merchantAnalytics = read("src/app/screens/merchant/MerchantAnalyticsScreen.tsx");
  const merchantDashboard = read("src/app/screens/merchant/MerchantDashboardScreen.tsx");
  const foodCredBadge = read("src/components/gamification/FoodCredBadge.tsx");
  const missionBanner = read("src/components/gamification/MissionBanner.tsx");
  const missionsScreen = read("src/app/screens/profile/MissionsScreen.tsx");
  const dishDetail = read("src/app/screens/detail/DishDetailScreenV2.tsx");

  assert.match(disclosure, /getServiceProvider\(\)\.mode === "supabase"/);
  assert.match(disclosure, /Live analytics/);
  assert.match(disclosure, /Preview analytics/);
  assert.match(disclosure, /Live mission progress/);
  assert.match(disclosure, /Preview mission progress/);
  assert.match(disclosure, /Live score/);
  assert.match(disclosure, /Preview score/);
  assert.match(disclosure, /Listed wait estimate/);
  assert.doesNotMatch(disclosure, /Live wait estimate/);
  assert.match(disclosure, /Preview wait estimate/);
  assert.match(merchantAnalytics, /getDataTrustDisclosure\("merchantAnalytics"\)/);
  assert.match(merchantDashboard, /getDataTrustDisclosure\("merchantAnalytics"\)/);
  assert.match(foodCredBadge, /getDataTrustDisclosure\("foodCred"\)/);
  assert.match(missionBanner, /getDataTrustDisclosure\("missions"\)/);
  assert.match(missionsScreen, /getDataTrustDisclosure\("missions"\)/);
  // The dish page no longer shows any wait estimate (detail-M6).
  assert.doesNotMatch(dishDetail, /waitEstimate|formatWaitTime/);
});

test("full project audit P1: user-facing data trust copy avoids live-result overclaims", () => {
  const locationPermission = read("src/app/screens/onboarding/LocationPermissionScreen.tsx");
  const aiAssistant = read("src/app/screens/merchant/AIAssistantScreen.tsx");
  const promotionBuilder = read("src/app/screens/merchant/PromotionBuilderScreen.tsx");

  assert.doesNotMatch(locationPermission, /real-time queues/i);
  assert.doesNotMatch(locationPermission, /exact stall/);
  assert.match(locationPermission, /Open directions to a stall/);
  assert.doesNotMatch(aiAssistant, /boost\s+sales/i);
  // Template summaries are not presented as AI, and unenforced audience targeting is not offered.
  assert.doesNotMatch(aiAssistant, /AI-assisted insights/);
  assert.match(aiAssistant, /Summaries are counted from your stall&apos;s own data/);
  assert.doesNotMatch(promotionBuilder, /AI-targeted users/i);
  assert.doesNotMatch(promotionBuilder, /Target Audience/);
  assert.match(promotionBuilder, /shown to everyone who views your stall/);
});
