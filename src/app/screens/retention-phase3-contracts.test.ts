import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { createRootLinking } from "@/app/navigation/linking";
import { formatDishUpdated } from "@/features/detail/dishFreshness";
import {
  getShareAttribution,
  parseShareSource,
  withShareSource,
} from "@/features/share/shareAttribution";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("shared links carry a source tag that is credited on signup", () => {
  assert.equal(
    withShareSource("https://usehungry.com/dish/d1", "whatsapp"),
    "https://usehungry.com/dish/d1?src=whatsapp",
  );
  assert.equal(
    withShareSource("https://x.test/a?b=1#c", "telegram"),
    "https://x.test/a?b=1&src=telegram#c",
  );
  assert.equal(parseShareSource("dish/d1?src=telegram"), "telegram");
  assert.equal(parseShareSource("dish/d1?src=evil"), undefined);

  const linking = createRootLinking("hungry://");
  const state = linking.getStateFromPath("dish/dish-1?src=whatsapp");
  assert.equal(state?.routes[1]?.name, "DishDetail");
  assert.deepEqual(getShareAttribution(), { source: "whatsapp", route: "DishDetail" });

  assert.match(
    read("src/features/share/messagingShare.ts"),
    /withShareSource\(target\.url, channel\)/,
  );
  assert.match(
    read("src/app/screens/review/ReviewShareSheet.tsx"),
    /withShareSource\(activeReview\.link, channel\)/,
  );
  assert.match(read("src/store/useSessionStore.ts"), /share_source: shareAttribution\.source/);
});

test("dishes show when they were last updated and never a stock photo", () => {
  assert.equal(formatDishUpdated(undefined), undefined);
  assert.equal(formatDishUpdated("not a date"), undefined);
  assert.match(
    formatDishUpdated(new Date(Date.now() - 3 * 86_400_000).toISOString()) ?? "",
    /^Updated 3d ago$/,
  );

  assert.match(
    read("src/lib/services/supabase/supabaseRepository.ts"),
    /updatedAt: toString\(row\.updated_at\) \|\| undefined/,
  );
  for (const path of [
    "src/components/dish/DishCard.tsx",
    "src/app/screens/discover/DecideForMeResultScreen.tsx",
    "src/app/screens/detail/DishDetailScreenV2.tsx",
  ]) {
    const source = read(path);
    assert.match(source, /formatDishUpdated\(/, path);
    assert.match(source, /<NoDishPhoto/, path);
  }
});

test("Decide For Me offers backup picks and a Not for me swap", () => {
  const source = read("src/app/screens/discover/DecideForMeResultScreen.tsx");
  assert.match(source, /label="Not for me"/);
  assert.match(source, /type: "dismissed"/);
  assert.match(source, /Other picks/);
  assert.match(source, /getOtherPicks\(candidates, resultIndex\)/);
  assert.match(
    source,
    /buildPickReason\(\s*profile\.tasteVector,\s*pick,\s*pickMatch,\s*hasTasteProfile\s*\)/,
  );
});

test("dish pages can add to a list in production", () => {
  const source = read("src/app/screens/detail/DishDetailScreenV2.tsx");
  // Saving to a collection lives in the action bar's hold menu.
  assert.match(source, /FEATURE_FLAGS\.portfoliosEnabled\s*\?\s*\[/);
  assert.match(source, /accessibilityLabel: "Save this dish to a collection"/);
  assert.match(source, /addToPortfolio\(\)/);
});
