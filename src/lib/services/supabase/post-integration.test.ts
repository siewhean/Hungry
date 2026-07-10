import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function methodSegment(source: string, methodName: string, nextMarker: string): string {
  const start = source.indexOf(`async ${methodName}`);
  const end = source.indexOf(nextMarker, start + 1);
  assert.notEqual(start, -1, `${methodName} must exist`);
  assert.notEqual(end, -1, `${nextMarker} marker must exist after ${methodName}`);
  return source.slice(start, end);
}

function functionSegment(source: string, functionName: string, nextMarker: string): string {
  const start = source.indexOf(`async function ${functionName}`);
  const end = source.indexOf(nextMarker, start + 1);
  assert.notEqual(start, -1, `${functionName} must exist`);
  assert.notEqual(end, -1, `${nextMarker} marker must exist after ${functionName}`);
  return source.slice(start, end);
}

test("Supabase social publish writes posts and post_media instead of legacy bites", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  const postBite = methodSegment(service, "postBite", "async reactToBite");
  const buildPostMediaRows = functionSegment(
    service,
    "buildPostMediaRows",
    "function postTypeForMedia",
  );

  assert.match(postBite, /from\("posts"\)[\s\S]*\.insert/);
  assert.match(postBite, /status: "draft"/);
  assert.match(buildPostMediaRows, /uploadPostMediaFromUri/);
  assert.match(buildPostMediaRows, /bucket: "post-media"/);
  assert.match(buildPostMediaRows, /mediaTypes\?\.\[index\]/);
  assert.match(buildPostMediaRows, /Post media must be uploaded from local device files/);
  assert.doesNotMatch(buildPostMediaRows, /storage_bucket: "external"/);
  assert.doesNotMatch(buildPostMediaRows, /image\/external|video\/external/);
  assert.match(postBite, /from\("post_media"\)\.insert/);
  assert.match(postBite, /from\("posts"\)[\s\S]*\.update/);
  assert.match(postBite, /status: "published"/);
  assert.match(postBite, /refreshSupabaseRepositoryCache/);
  assert.doesNotMatch(postBite, /from\("bites"\)/);
  assert.doesNotMatch(postBite, /"bites-media"/);
});

test("composer cache uses returned post media URLs after upload", () => {
  const publishing = read("src/features/post/publishing.ts");

  assert.match(publishing, /mediaUrls: bite\.mediaUrls \?\? media\.mediaUrls/);
  assert.match(publishing, /mediaType: bite\.mediaType \?\? media\.mediaType/);
  assert.doesNotMatch(publishing, /mediaUrls: media\.mediaUrls,\n\s+tags/);
});

test("Supabase social feed reads published posts and post_media", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  const getBitesFeed = methodSegment(service, "getBitesFeed", "async postBite");
  const fetchPublishedPostBites = functionSegment(
    service,
    "fetchPublishedPostBites",
    "function listAllDishesFromRepository",
  );

  assert.match(getBitesFeed, /fetchPublishedPostBites\(client\)/);
  assert.match(fetchPublishedPostBites, /from\("posts"\)/);
  assert.match(fetchPublishedPostBites, /\.eq\("status", "published"\)/);
  assert.match(fetchPublishedPostBites, /\.is\("deleted_at", null\)/);
  assert.match(fetchPublishedPostBites, /from\("post_media"\)/);
  assert.match(fetchPublishedPostBites, /resolvePostMediaDisplayUrl/);
  assert.doesNotMatch(getBitesFeed, /from\("bites"\)/);
});

test("Supabase social reactions use post engagement tables", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  const serviceTypes = read("src/lib/services/types.ts");
  const reactToBite = methodSegment(service, "reactToBite", "async getStories");
  const shareBite = methodSegment(service, "shareBite", "async getStories");
  const getSavedBites = methodSegment(service, "getSavedBites", "async getLikedBites");
  const getLikedBites = methodSegment(service, "getLikedBites", "},\n  },\n\n  communitySafety");

  assert.match(reactToBite, /post_likes/);
  assert.match(reactToBite, /post_saves/);
  assert.match(reactToBite, /\.eq\("post_id", biteId\)/);
  assert.doesNotMatch(reactToBite, /bite_reactions/);
  assert.match(serviceTypes, /shareBite\(/);
  assert.match(shareBite, /from\("post_shares"\)\.insert/);
  assert.match(shareBite, /post_id: biteId/);
  assert.match(shareBite, /share_channel: options\?\.channel \?\? "in_app"/);
  assert.match(getSavedBites, /from\("post_saves"\)/);
  assert.match(getLikedBites, /from\("post_likes"\)/);
  assert.match(getSavedBites, /fetchPublishedPostBites\(client\)/);
  assert.match(getLikedBites, /fetchPublishedPostBites\(client\)/);
});

test("post engagement migration keeps denormalized counts in sync", () => {
  const migration = read("supabase/migrations/0026_post_engagement_count_triggers.sql");
  const smoke = read("supabase/smoke/integration_readiness.sql");

  assert.match(migration, /sync_post_engagement_counts/);
  assert.match(migration, /security definer/);
  assert.match(migration, /like_count = \(select count\(\*\)::integer from public\.post_likes/i);
  assert.match(migration, /save_count = \(select count\(\*\)::integer from public\.post_saves/i);
  assert.match(migration, /share_count = \(select count\(\*\)::integer from public\.post_shares/i);
  assert.match(migration, /trg_post_likes_sync_counts/);
  assert.match(migration, /trg_post_saves_sync_counts/);
  assert.match(migration, /trg_post_shares_sync_counts/);
  assert.match(smoke, /expected_triggers/);
  assert.match(smoke, /trg_post_likes_sync_counts/);
});

test("Supabase repository exposes published posts to shared Home/Profile reads", () => {
  const repository = read("src/lib/services/supabase/supabaseRepository.ts");

  assert.match(repository, /from\("posts"\)/);
  assert.match(repository, /\.eq\("status", "published"\)/);
  assert.match(repository, /\.is\("deleted_at", null\)/);
  assert.match(repository, /from\("post_media"\)/);
  assert.match(repository, /mapPostRowToStallPost/);
  assert.match(repository, /generated_content/);
  assert.match(repository, /cachedStallPosts = \[/);
});

test("post-media storage policy follows post visibility instead of author-only reads", () => {
  const migration = read("supabase/migrations/0025_post_media_visible_storage_policy.sql");
  const smoke = read("supabase/smoke/integration_readiness.sql");

  assert.match(migration, /post_media_select_visible_post_objects/);
  assert.match(migration, /bucket_id = 'post-media'/);
  assert.match(migration, /public\.can_read_post\(pm\.post_id\)/);
  assert.match(smoke, /post_media_select_visible_post_objects/);
});
