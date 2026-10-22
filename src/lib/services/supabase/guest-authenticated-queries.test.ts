import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const service = read("src/lib/services/supabase/supabaseService.ts");

/** Source of one service method, from its signature to the first RPC/query call that follows. */
function methodUntil(signature: RegExp, marker: RegExp) {
  const start = service.search(signature);
  assert.notEqual(start, -1, `missing method ${signature}`);
  const rest = service.slice(start);
  const end = rest.search(marker);
  assert.notEqual(end, -1, `missing ${marker} after ${signature}`);
  return rest.slice(0, end);
}

test("listFollowing skips the RPC for non-uuid ids and signed-out viewers", () => {
  const guard = methodUntil(/async listFollowing\(/, /client\.rpc\("list_user_following"/);
  assert.match(
    guard,
    /!UUID_PATTERN\.test\(userId\) \|\| !\(await getCurrentSupabaseUserId\(\)\)\) return \[\]/,
  );
});

test("getFollowRequestCount returns 0 without a session instead of calling the RPC", () => {
  const guard = methodUntil(
    /async getFollowRequestCount\(/,
    /client\.rpc\("count_incoming_follow_requests"\)/,
  );
  assert.match(guard, /if \(!\(await getCurrentSupabaseUserId\(\)\)\) return 0/);
});

test("getUserReviews returns empty for non-uuid ids before any query", () => {
  const guard = methodUntil(
    /async getUserReviews\(userId, page\)/,
    /await getCurrentSupabaseUserId\(\)/,
  );
  assert.match(guard, /if \(!UUID_PATTERN\.test\(userId\)\) return \[\]/);
});

test("listUserPosts returns empty for non-uuid ids before any query", () => {
  const guard = methodUntil(/async listUserPosts\(userId: string/, /fetchPublishedPostBites\(/);
  assert.match(guard, /if \(!UUID_PATTERN\.test\(userId\)\) return \[\]/);
});

test("getFoodHistory still requires a session before calling the RPC", () => {
  const guard = methodUntil(/async getFoodHistory\(/, /client\.rpc\("get_my_food_history"/);
  assert.match(guard, /if \(!client \|\| !userId\) return \[\]/);
});

test("authenticated uuid callers still reach each RPC/query", () => {
  assert.match(service, /client\.rpc\("list_user_following", \{/);
  assert.match(service, /client\.rpc\("count_incoming_follow_requests"\)/);
  assert.match(service, /client\.rpc\("get_my_food_history", \{ p_limit: 300 \}\)/);
  assert.match(service, /\.rpc\("get_user_profile_reviews", \{ p_user_id: userId \}\)/);
  assert.match(service, /authorId: userId,\s*offset: page\?\.offset \?\? 0/);
});

test("profile store skips food history for the non-uuid guest profile in supabase mode", () => {
  const store = read("src/store/useProfileStore.ts");
  assert.match(
    store,
    /loadFoodHistory: async \(\) => \{\s*const userId = get\(\)\.profile\.id;\s*\/\/[^\n]*\n\s*if \(getConfiguredDataSource\(\) === "supabase" && !isUuidLikeProfileId\(userId\)\) return;\s*try \{\s*const rows = await getHungryService\(\)\.recommendations\.getFoodHistory\(\)/,
  );
});

test("session store skips the follow-state sync for non-uuid ids in supabase mode", () => {
  const store = read("src/store/useSessionStore.ts");
  assert.match(
    store,
    /function syncFollowStateFromServer\([\s\S]*?\): void \{\s*if \(!userId\) return;\s*\/\/[^\n]*\n\s*if \(getConfiguredDataSource\(\) === "supabase" && !isUuidLike\(userId\)\) return;[\s\S]*?\.syncFollowedUserIds\(userId\)/,
  );
});
