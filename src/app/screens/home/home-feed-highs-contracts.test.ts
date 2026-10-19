import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

test("consumer feed posts lead to the dish, the stall and the post", () => {
  const home = read("src/app/screens/home/HomeFeedScreen.tsx");
  // Overlay dish title opens the dish (or stall when no dish is linked).
  assert.match(home, /onPress=\{\(\) => navigateToDish\(item\)\}\s*>\s*<AppText variant="h3"/);
  // Without map access the venue line opens the stall instead of being plain text.
  assert.equal(
    home.match(
      /onPress=\{\(\) =>\s*navigation\.navigate\("StallDetail", \{ venueId: item\.venueId \}\)/g,
    )?.length,
    2,
  );
  // With comments off, the caption opens the post detail.
  assert.match(home, /navigation\.navigate\("ActivityPostDetail", \{ postId: item\.id \}\)/);
});

test("carousel index is not written to screen state on every scroll frame", () => {
  const home = read("src/app/screens/home/HomeFeedScreen.tsx");
  assert.doesNotMatch(home, /contentOffset\.x \/ viewportWidth;\n/);
  // Rounded page index, and the state setter bails out when it is unchanged.
  assert.match(
    home,
    /const nextIndex = Math\.round\(event\.nativeEvent\.contentOffset\.x \/ viewportWidth\)/,
  );
  assert.match(home, /if \(current\[carouselPostKey\] === clampedIndex\) \{\s*return current;/);
});

test("repository post cache is bounded and honours the viewer's hidden posts", () => {
  const repo = read("src/lib/services/supabase/supabaseRepository.ts");
  assert.match(repo, /\.limit\(CACHED_POST_LIMIT\)/);
  assert.match(repo, /from\("hidden_posts"\)\.select\("post_id"\)/);
  assert.match(repo, /\.in\("post_id", cachedPostIds\)/);
  assert.match(repo, /!hiddenPostIds\.has\(toString\(row\.id\)\)/);
  assert.doesNotMatch(repo, /client\.from\("post_media"\)\.select\("\*"\)\.order/);
});

test("repository post cache also keeps the viewer's saved and liked posts", () => {
  const repo = read("src/lib/services/supabase/supabaseRepository.ts");
  assert.match(repo, /from\("post_saves"\)\.select\("post_id"\)\.eq\("user_id", viewerId\)/);
  assert.match(repo, /from\("post_likes"\)\.select\("post_id"\)\.eq\("user_id", viewerId\)/);
  assert.match(repo, /\.in\("id", \[\.\.\.reactedIds\]\)/);
  assert.match(repo, /const cachedPostRows = \[\.\.\.recentPostRows, \.\.\.viewerPostRows\]/);
});
