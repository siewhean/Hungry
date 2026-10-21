import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import {
  TASTE_NOT_BUILT_SUMMARY,
  buildTastePersonaSummary,
  buildTasteShareMessage,
  hasTasteSignal,
  topTasteLeans,
} from "@/features/profile/tasteFingerprint";
import { STALL_SUBMISSION_STATUS } from "@/features/profile/stallSubmissionStatus";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

test("taste fingerprint: a neutral vector is not a signal, a clear lean is", () => {
  assert.equal(hasTasteSignal(NEUTRAL_TASTE_VECTOR), false);
  assert.equal(buildTastePersonaSummary(NEUTRAL_TASTE_VECTOR), TASTE_NOT_BUILT_SUMMARY);
  assert.equal(hasTasteSignal({ ...NEUTRAL_TASTE_VECTOR, spicy: 5.4 }), false);
  // Disliking a taste is a signal for the bars, but only likes name the persona.
  assert.equal(hasTasteSignal({ ...NEUTRAL_TASTE_VECTOR, sweet: 2 }), true);

  const vector = { ...NEUTRAL_TASTE_VECTOR, spicy: 9, rich: 7, sweet: 1 };
  assert.deepEqual(
    topTasteLeans(vector, 3).map((entry) => entry.label),
    ["Spicy", "Rich"],
  );
  assert.equal(buildTastePersonaSummary(vector), "You lean spicy and rich.");
  assert.equal(
    buildTasteShareMessage(vector),
    "Check out my Taste Fingerprint on Hungry!\n\nTop taste traits: Spicy 90%, Rich 70%",
  );
  assert.equal(
    buildTasteShareMessage(NEUTRAL_TASTE_VECTOR),
    "Check out my Taste Fingerprint on Hungry!",
  );
});

test("stall submission statuses all have a label and a plain explanation", () => {
  for (const status of ["pending", "under_review", "accepted", "rejected", "duplicate"] as const) {
    assert.ok(STALL_SUBMISSION_STATUS[status].label.length > 0);
    assert.ok(STALL_SUBMISSION_STATUS[status].detail.length > 0);
  }
});

test("G8 migrations: guest follow counts, remove follower, people search, name length", () => {
  const follow = read(
    "supabase/migrations/20261022080000_follow_counts_for_guests_remove_follower.sql",
  );
  assert.match(
    follow,
    /grant execute on function app_private\.get_follow_counts\(uuid\)\s+to anon/,
  );
  assert.match(follow, /grant execute on function public\.get_follow_counts\(uuid\)\s+to anon/);
  assert.match(
    follow,
    /create or replace function app_private\.remove_follower\(p_follower_id uuid\)/,
  );
  assert.match(follow, /security definer/);
  assert.match(
    follow,
    /grant execute on function public\.remove_follower\(uuid\) to authenticated, service_role/,
  );
  assert.doesNotMatch(follow, /grant execute on function public\.remove_follower\(uuid\) to anon/);

  const search = read(
    "supabase/migrations/20261022081000_search_profiles_and_display_name_length.sql",
  );
  assert.match(search, /idx_user_profiles_display_name_trgm/);
  assert.match(search, /create or replace function app_private\.search_profiles\(/);
  assert.match(search, /app_private\.app_user_block_exists/);
  assert.match(
    search,
    /grant execute on function public\.search_profiles\(text, integer, integer\)/,
  );
  assert.doesNotMatch(search, /grant execute[^;]*to anon/);
  assert.match(search, /trg_user_profiles_limit_display_name/);
  assert.match(search, /left\(/);

  for (const smoke of [
    "follow_counts_for_guests_remove_follower",
    "search_profiles_display_name_length",
    "user_stall_submission_limits",
  ]) {
    const sql = read(`supabase/smoke/${smoke}.sql`);
    assert.match(sql, /^begin;/m, `${smoke} smoke starts a transaction`);
    assert.match(sql, /^rollback;/m, `${smoke} smoke rolls back`);
  }
});

test("G8 migration: stall submissions are capped per field and per day", () => {
  const sql = read("supabase/migrations/20261022082000_user_stall_submission_limits.sql");
  assert.match(sql, /app_private\.enforce_user_stall_submission_limits\(\)/);
  assert.match(sql, /security definer/);
  assert.match(sql, /before insert on public\.user_stall_submissions/);
  assert.match(sql, /interval '24 hours'|interval '1 day'/);
  assert.match(sql, /errcode = '54000'/);
  assert.match(sql, /daily limit for stall submissions/);
});

test("G8 services: paged reviews, id-based saved posts, removable photo, people search", () => {
  const types = read("src/lib/services/types.ts");
  const supabase = read("src/lib/services/supabase/supabaseService.ts");
  const mock = read("src/lib/services/mock/mockService.ts");

  assert.match(
    types,
    /getUserReviews\(\s*userId: string,\s*page\?: \{ limit\?: number; offset\?: number \},?\s*\)/,
  );
  assert.match(types, /removeFollower\(userId: string\)/);
  assert.match(types, /searchProfiles\(/);
  assert.match(supabase, /\.rpc\("remove_follower"/);
  assert.match(supabase, /\.rpc\("search_profiles"/);
  assert.match(supabase, /favouritesCount: favouriteDishIds\.length/);
  assert.match(supabase, /stalls_visited/);
  assert.match(mock, /async removeFollower\(/);
  assert.match(mock, /async searchProfiles\(/);
});

test("G8 own profile: signed-out view, honest taste, grouped menu, stall contribution", () => {
  const home = read("src/app/screens/profile/ProfileHomeScreen.tsx");

  assert.match(home, /hasTasteFingerprint/);
  assert.match(home, /Take the taste quiz/);
  assert.match(home, /buildTasteShareMessage\(/);
  assert.match(home, /profileShareUrl\(profile\.id, "system_share"\)/);
  assert.match(home, /trackAnalyticsEvent\("profile_viewed"/);
  assert.match(home, /trackAnalyticsEvent\("profile_shared"/);
  assert.match(home, /trackAnalyticsEvent\("taste_fingerprint_shared"/);
  assert.match(home, /Only approved followers can see your profile through the link\./);
  assert.match(home, /OWN_REVIEWS_INLINE_LIMIT/);
  assert.match(home, /textOnOrange/);
  assert.match(home, /StyleSheet\.hairlineWidth/);
  assert.doesNotMatch(home, /Add Discovered Stall/);
});

test("G8 other profiles: loading and failure states, paged reviews, shared follow button", () => {
  const content = read("src/app/screens/profile/UserProfileContent.tsx");

  assert.match(content, /publicProfileStatus/);
  assert.match(content, /"Profile not found"/);
  assert.match(content, /Couldn't load this profile/);
  assert.match(content, /USER_REVIEWS_PAGE_SIZE/);
  assert.match(content, /publicProfile\?\.stallsVisited/);
  assert.match(content, /trackAnalyticsEvent\("profile_viewed"/);
  assert.match(content, /<FollowPillButton/);
});

test("G8 follower lists: virtualised rows, remove follower, find people, analytics", () => {
  const connections = read("src/app/screens/profile/ProfileConnectionsScreen.tsx");
  const requests = read("src/app/screens/profile/FollowRequestsScreen.tsx");
  const social = read("src/store/useSocialStore.ts");
  const analytics = read("src/lib/analytics/types.ts");

  assert.match(connections, /<FlatList/);
  assert.match(connections, /removeFollower\(/);
  assert.match(connections, /searchProfiles\(/);
  assert.match(requests, /"follow_request_approved"/);
  assert.match(requests, /"follow_request_declined"/);
  assert.match(social, /status: result === "pending" \? "pending" : "approved"/);
  for (const name of [
    "profile_viewed",
    "profile_shared",
    "taste_fingerprint_shared",
    "follow_request_approved",
    "follow_request_declined",
  ]) {
    assert.ok(analytics.includes(`"${name}"`), `${name} is a known analytics event`);
  }
});

test("G8 follow analytics fire after the service call resolves, not before", () => {
  const social = read("src/store/useSocialStore.ts");
  const call = social.indexOf("social.followUser");
  const track = social.indexOf('"user_followed"');
  assert.ok(call > 0 && track > call, "user_followed is tracked after the follow call");
});

test("G8 lists and detail screens: loading, error and retry states", () => {
  for (const file of [
    "ReviewHistoryScreen",
    "VisitedStallsScreen",
    "FollowedStallsScreen",
    "StallSubmissionsScreen",
  ]) {
    const source = read(`src/app/screens/profile/${file}.tsx`);
    assert.match(source, /Retry/, `${file} offers Retry`);
  }
  const history = read("src/app/screens/profile/ReviewHistoryScreen.tsx");
  assert.match(history, /useIsFocused/);
  assert.match(history, /REVIEW_HISTORY_PAGE_SIZE/);
  assert.match(history, /No written notes/);

  const visited = read("src/app/screens/profile/VisitedStallsScreen.tsx");
  assert.doesNotMatch(visited, /Open now|Closed now/);

  const favourites = read("src/app/screens/profile/FavouritesScreen.tsx");
  assert.match(favourites, /SavedPostsSection/);
  assert.match(favourites, /getSavedBites\(\)/);
  assert.match(favourites, /ActivityPostDetail/);
});

test("G8 add stall: all planning areas, nearby stalls, friendly errors, no permission pre-prompt", () => {
  const screen = read("src/app/screens/profile/AddStallScreen.tsx");
  const stack = read("src/app/screens/profile/ProfileStack.tsx");
  const navTypes = read("src/app/navigation/navigationTypes.ts");

  for (const area of [
    "Bishan",
    "Sengkang",
    "Bukit Batok",
    "Choa Chu Kang",
    "Kallang",
    "Novena",
    "Other",
  ]) {
    assert.ok(screen.includes(`"${area}"`), `${area} is selectable`);
  }
  assert.match(screen, /Already on Hungry\? Open it/);
  assert.match(screen, /searchPickerVenues\(/);
  assert.match(screen, /resolveSubmitErrorMessage/);
  assert.match(screen, /Couldn't submit the stall\. Please try again\./);
  assert.doesNotMatch(screen, /confirmGalleryAccess|isGalleryPermissionGranted/);
  assert.match(screen, /maxLength=\{120\}/);
  assert.match(stack, /name="StallSubmissions"/);
  assert.match(navTypes, /StallSubmissions: undefined/);
});

test("G8 edit profile: display name is capped and the photo can be removed", () => {
  const edit = read("src/app/screens/profile/EditProfileScreen.tsx");
  assert.match(edit, /label="Display name"[\s\S]*?maxLength=\{PROFILE_DISPLAY_NAME_MAX_LENGTH\}/);
  assert.match(edit, /label="Remove photo"/);
  assert.match(edit, /setAvatarUri\(""\)/);
  assert.match(edit, /avatarUrl: avatarUri,/);
});

test("G8 missions: the data disclosure is a footnote, not part of the subtitle", () => {
  const missions = read("src/app/screens/profile/MissionsScreen.tsx");
  assert.match(
    missions,
    /subtitle=\{`\$\{completedCount\}\/\$\{missions\.length\} completed · \$\{weekLabel\}`\}/,
  );
  assert.match(missions, /testID="missions-disclosure"/);
});
