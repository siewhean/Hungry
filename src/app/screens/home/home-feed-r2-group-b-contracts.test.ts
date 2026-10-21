import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

test("H9: guests get a public Home feed and a sign-in empty state", () => {
  const sql = read("supabase/migrations/20261021130000_public_home_feed_and_post_media.sql");
  const smoke = read("supabase/smoke/public_home_feed_and_post_media.sql");
  const privateBody =
    /create or replace function app_private\.get_public_home_feed[\s\S]*?\$\$;/.exec(sql)?.[0];
  const publicBody = /create or replace function public\.get_public_home_feed[\s\S]*?\$\$;/.exec(
    sql,
  )?.[0];
  assert.ok(privateBody && publicBody);
  assert.match(privateBody, /security definer/);
  assert.match(publicBody, /security invoker/);
  assert.doesNotMatch(publicBody, /security definer/);
  // Same rule get_post_by_id applies to visitors: public posts by public accounts.
  assert.match(privateBody, /p\.visibility = 'public'/);
  assert.match(privateBody, /app_private\.can_read_author_content\(p\.author_id\)/);
  assert.match(privateBody, /pms\.state in \('hidden', 'removed'\)/);
  assert.match(privateBody, /from public\.hidden_posts hp/);
  assert.match(
    sql,
    /grant execute on function public\.get_public_home_feed\(integer, timestamptz, uuid\)\s+to anon/,
  );
  assert.match(smoke, /^begin;/m);
  assert.match(smoke, /^rollback;/m);

  const service = read("src/lib/services/supabase/supabaseService.ts");
  assert.match(service, /client\.rpc\("get_public_home_feed"/);
  assert.match(
    service,
    /if \(!\(await getCurrentSupabaseUserId\(\)\)\) \{\s*const publicBites = await fetchPublicHomeFeedBites\(client, page\);/,
  );

  const home = read("src/app/screens/home/HomeFeedScreen.tsx");
  assert.match(home, /title="Sign in to see your feed"/);
  assert.match(home, /onCtaPress=\{openSignInFromEmptyFeed\}/);
});

test("H10: visitors can sign the photo of a public post, nothing else", () => {
  const sql = read("supabase/migrations/20261021130000_public_home_feed_and_post_media.sql");
  assert.match(
    sql,
    /create policy "post_media_select_public_post_objects_anon"\s+on storage\.objects for select to anon/,
  );
  assert.match(sql, /app_private\.can_read_public_post_media_object\(bucket_id, name\)/);
  const helper =
    /create or replace function app_private\.can_read_public_post_media_object[\s\S]*?\$\$;/.exec(
      sql,
    )?.[0];
  assert.ok(helper);
  assert.match(helper, /security definer/);
  assert.match(helper, /p\.visibility = 'public'/);
  assert.match(helper, /p\.status = 'published'/);
  assert.match(helper, /app_private\.can_read_author_content\(p\.author_id\)/);
});

test("H11: a like, save, comment or share tap does not reload the feed", () => {
  const home = read("src/app/screens/home/HomeFeedScreen.tsx");
  const keyBlock = /const profileFeedKey = useMemo\([\s\S]*?\]\);/.exec(home)?.[0];
  assert.ok(keyBlock);
  assert.doesNotMatch(keyBlock, /tasteVector/);
  assert.match(home, /getHomeFeedBundle\(profileRef\.current,/);
  assert.match(
    home,
    /\[followedAuthors, followedUserIds, initializeInteractions, profileFeedKey\],/,
  );
  // home_feed_viewed once per focus.
  assert.match(home, /if \(!feedViewTrackedRef\.current\) \{/);
  assert.match(home, /feedViewTrackedRef\.current = false;\s*const cancelIdle = scheduleIdleWork/);
});

test("H12: feed and post videos pause off screen and in the background", () => {
  const home = read("src/app/screens/home/HomeFeedScreen.tsx");
  assert.match(home, /const isFocused = useIsFocused\(\);/);
  assert.match(home, /isVideoActive=\{isFocused && activeVideoPostId === item\.id\}/);
  assert.match(read("src/components/social/FeedPostCard.tsx"), /isActive=\{isVideoActive\}/);

  const detail = read("src/app/screens/home/ActivityPostDetailScreen.tsx");
  assert.match(detail, /const isFocused = useIsFocused\(\);/);
  assert.match(detail, /<ZoomableMedia[\s\S]*?isActive=\{isFocused\}/);

  const video = read("src/components/social/ZoomableVideo.tsx");
  assert.match(video, /AppState\.addEventListener\("change"/);
  assert.match(video, /const shouldPlay = isPlaying && isActive && isAppActive;/);
});
