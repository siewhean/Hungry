// Renders every screen in the app (react-native-web + jsdom, mock data) and checks it shows what it
// should. Run with `npm run test:render`.

import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import test, { before } from "node:test";
import type { ComponentType } from "react";

import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { renderScreen } from "@/test/render";
import { KNOWN_RENDER_ERRORS, SCREEN_MATRIX, type ParamKey } from "@/test/render/screenMatrix";
import { enterScenario } from "@/test/render/sessions";

function walk(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, found);
    else if (full.endsWith(".tsx") && !full.includes(".test.")) found.push(full);
  }
  return found;
}

function screenExports(file: string): string[] {
  const mod = require(path.resolve(file)) as Record<string, unknown>;
  return Object.entries(mod)
    .filter(([name, value]) => /Screen(V2)?$/.test(name) && typeof value === "function")
    .map(([name]) => name);
}

let params: Record<ParamKey, object>;

before(async () => {
  await enterScenario("user");
  const repo = getDataRepository();
  const service = getHungryService();
  const dish = repo.listPopularNearby()[0];
  const post = repo.listStallPosts()[0];
  const reviews = await service.reviews.getReviewsForDish(dish.id);
  const stories = await service.social.getStories();
  const conversations = await service.chat.listConversations();
  const checklist = await service.checklist.createChecklist("Render test list");
  const portfolio = await service.portfolio.createPortfolio({
    name: "Render test list",
    type: "recommendation",
    visibility: "public",
  });
  params = {
    postRoute: { postId: post.id, updateId: "u1" },
    catalogDish: { kind: "dish", id: dish.id, releaseId: "r1" },
    chat: { chatId: conversations[0].id, name: conversations[0].title, avatar: "", isOnline: true },
    checklist: { checklistId: checklist.id },
    checklistPicker: { checklistId: checklist.id, mode: "dish" },
    dish: { id: dish.id },
    dishReviews: { dishId: dish.id },
    portfolio: { portfolioId: portfolio.id },
    portfolioPicker: { portfolioId: portfolio.id, mode: "dish" },
    report: { venueId: dish.venueId, dishId: dish.id, subjectName: dish.name },
    review: { reviewId: reviews[0]?.id ?? "review-1" },
    socialGrid: { type: "saved" },
    socialPost: { postId: post.id, type: "saved" },
    stall: { id: dish.venueId, venueId: dish.venueId },
    story: { initialStoryId: stories[0]?.id ?? "story-1" },
    otherUser: { authorId: "user-emma", authorName: "Emma" },
  };
});

test("every screen in src/app/screens has a row in the screen matrix", () => {
  const discovered = walk("src/app/screens")
    .sort()
    .flatMap((file) => screenExports(file).map((name) => `${name} (${file})`));
  const covered = new Set(SCREEN_MATRIX.map((row) => row.name));
  const missing = discovered.filter((entry) => !covered.has(entry.split(" ")[0]));
  assert.deepEqual(
    missing,
    [],
    "These screens are not rendered by any test. Add a row for each to src/test/render/screenMatrix.ts.",
  );
  const names = SCREEN_MATRIX.map((row) => row.name);
  assert.equal(new Set(names).size, names.length, "duplicate matrix rows");
  const exportsByName = new Set(discovered.map((entry) => entry.split(" ")[0]));
  assert.deepEqual(
    names.filter((name) => !exportsByName.has(name)),
    [],
    "matrix rows for screens that no longer exist",
  );
});

for (const row of SCREEN_MATRIX) {
  test(`${row.name} renders for a ${row.scenario} and shows its content`, async () => {
    await enterScenario(row.scenario);
    const Component = (require(path.resolve(row.file)) as Record<string, unknown>)[
      row.name
    ] as ComponentType<never>;
    assert.equal(typeof Component, "function", `${row.file} must export ${row.name}`);

    const errors: string[] = [];
    const originalError = console.error;
    const originalWarn = console.warn;
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    };
    console.warn = () => undefined;
    try {
      const view = await renderScreen(Component, {
        name: row.name,
        params: row.params ? params[row.params] : undefined,
      });
      try {
        assert.match(
          view.text(),
          row.expect,
          `${row.name} did not show ${row.expect}; it showed: ${view.text().slice(0, 300)}`,
        );
        assert.doesNotMatch(
          view.text(),
          /Something went wrong/,
          "an error boundary caught a crash",
        );
      } finally {
        await view.unmount();
      }
    } finally {
      console.error = originalError;
      console.warn = originalWarn;
    }

    const known = row.known ? KNOWN_RENDER_ERRORS[row.known].pattern : null;
    const unexpected = errors.filter((message) => !(known && known.test(message)));
    assert.deepEqual(unexpected, [], `${row.name} logged console errors while rendering`);
  });
}
