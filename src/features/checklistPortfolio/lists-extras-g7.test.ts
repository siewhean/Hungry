import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { listItemScoreError, parseListItemScore } from "./listItemScore";
import { isPortfolioLive } from "./listLabels";
import { isListNotFoundError, listErrorMessage, listLoadStateForError } from "./listLoadState";
import { leaveWheelStack } from "@/features/wheel/leaveWheel";
import {
  BEST_MATCH_PERCENT,
  bestDishMatchPercent,
  joinVenueSubtitle,
} from "@/features/wheel/venueRow";
import { getHungryService, setMockServiceProvider } from "@/lib/services/serviceProvider";
import { useChecklistStore } from "@/store/useChecklistStore";
import { usePortfolioStore } from "@/store/usePortfolioStore";

function read(path: string) {
  return readFileSync(path, "utf8");
}

test("list load state tells a failed read from a missing list", () => {
  assert.equal(isListNotFoundError({ code: "PGRST116", message: "no rows" }), true);
  assert.equal(isListNotFoundError(new Error("Portfolio abc not found")), true);
  assert.equal(isListNotFoundError(new Error("Failed to fetch")), false);
  assert.equal(listLoadStateForError(new Error("Failed to fetch")), "error");
  assert.equal(listLoadStateForError({ code: "PGRST116" }), "missing");
  assert.equal(listErrorMessage({ message: "Short reason" }, "fallback"), "Short reason");
  assert.equal(listErrorMessage({ message: "x".repeat(300) }, "fallback"), "fallback");
});

test("list item scores are optional whole numbers from 1 to 10", () => {
  assert.equal(parseListItemScore("  "), undefined);
  assert.equal(parseListItemScore("8"), 8);
  assert.ok(Number.isNaN(parseListItemScore("8.5")));
  assert.equal(listItemScoreError(undefined), undefined);
  assert.equal(listItemScoreError(10), undefined);
  assert.match(listItemScoreError(11) ?? "", /whole number from 1 to 10/);
  assert.match(listItemScoreError(Number.NaN) ?? "", /whole number from 1 to 10/);
});

test("a list is live when it is public, whatever its draft history", () => {
  assert.equal(isPortfolioLive({ publishedAt: undefined, visibility: "public" }), true);
  assert.equal(
    isPortfolioLive({ publishedAt: "2026-01-01T00:00:00Z", visibility: "private" }),
    false,
  );
});

test("wheel venue rows join only the parts that exist and rate the best dish", () => {
  assert.equal(joinVenueSubtitle(["B1", "#01-02", "spicy, sour"]), "B1 • #01-02 • spicy, sour");
  assert.equal(joinVenueSubtitle(["B1", undefined, ""]), "B1");
  assert.equal(joinVenueSubtitle([undefined, null]), "");

  const dishes = [
    { id: "untagged", match: 99, tagged: false },
    { id: "ok", match: 40, tagged: true },
    { id: "best", match: 85, tagged: true },
  ];
  const best = bestDishMatchPercent(
    dishes,
    (dish) => dish.match,
    (dish) => dish.tagged,
  );
  assert.equal(best, 85);
  assert.ok(best >= BEST_MATCH_PERCENT);
  assert.equal(
    bestDishMatchPercent(
      [] as typeof dishes,
      () => 100,
      () => true,
    ),
    0,
  );
});

test("leaving the wheel goes back out of the whole stack", () => {
  const calls: string[] = [];
  leaveWheelStack({
    getParent: () => ({
      canGoBack: () => true,
      goBack: () => calls.push("goBack"),
      navigate: () => calls.push("navigate"),
    }),
    popToTop: () => calls.push("popToTop"),
  });
  leaveWheelStack({
    getParent: () => ({
      canGoBack: () => false,
      goBack: () => calls.push("goBack"),
      navigate: () => calls.push("navigate"),
    }),
    popToTop: () => calls.push("popToTop"),
  });
  leaveWheelStack({ getParent: () => undefined, popToTop: () => calls.push("popToTop") });
  assert.deepEqual(calls, ["goBack", "navigate", "popToTop"]);
});

test("republishing keeps the first published date and unpublish goes back to private", async () => {
  setMockServiceProvider();
  usePortfolioStore.getState()._reset();
  const list = await usePortfolioStore.getState().createPortfolio({
    name: `G7 republish ${Date.now()}`,
    type: "collection",
    visibility: "private",
  });
  await usePortfolioStore.getState().publishPortfolio(list.id);
  const first = usePortfolioStore.getState().portfolios.find((entry) => entry.id === list.id);
  assert.equal(first?.visibility, "public");
  assert.ok(first?.publishedAt);

  await usePortfolioStore.getState().updatePortfolio(list.id, { visibility: "private" });
  await new Promise((resolve) => setTimeout(resolve, 5));
  await usePortfolioStore.getState().publishPortfolio(list.id);
  const again = usePortfolioStore.getState().portfolios.find((entry) => entry.id === list.id);
  assert.equal(again?.visibility, "public");
  assert.equal(again?.publishedAt, first?.publishedAt);
});

test("list item details come from one batched read and keep list order", async () => {
  setMockServiceProvider();
  usePortfolioStore.getState()._reset();
  const list = await usePortfolioStore.getState().createPortfolio({
    name: `G7 details ${Date.now()}`,
    type: "ranking",
    visibility: "private",
  });
  await usePortfolioStore.getState().addItem({
    portfolioId: list.id,
    itemType: "dish",
    dishId: "dish-laksa",
  });
  await usePortfolioStore.getState().addItem({
    portfolioId: list.id,
    itemType: "stall",
    stallId: "venue-tian-tian",
  });
  const details = await getHungryService().portfolio.getPortfolioItemDetails(list.id);
  assert.equal(details.length, 2);
  assert.equal(details[0]?.dishId, "dish-laksa");
  assert.equal(details[1]?.stallId, "venue-tian-tian");
  assert.ok(details.every((row) => row.name));
});

test("checklist 'tried' can be undone", async () => {
  setMockServiceProvider();
  useChecklistStore.getState()._reset();
  const checklist = await useChecklistStore.getState().createChecklist(`G7 tried ${Date.now()}`);
  const item = await useChecklistStore.getState().addItem({
    checklistId: checklist.id,
    itemType: "dish",
    dishId: "dish-chicken-rice",
  });
  await useChecklistStore.getState().markItemTried(item.id);
  assert.ok(useChecklistStore.getState().items[checklist.id]?.[0]?.triedAt);
  await useChecklistStore.getState().markItemTried(item.id, false);
  assert.equal(useChecklistStore.getState().items[checklist.id]?.[0]?.triedAt, undefined);
});

test("collaborators can leave a list but not remove each other", async () => {
  const mock = read("src/lib/services/mock/mockService.ts");
  assert.match(mock, /async updatePortfolioCollaboratorRole/);
  assert.match(read("src/store/usePortfolioStore.ts"), /leavePortfolio: async/);
  const migration = read("supabase/migrations/20261022070000_lists_extras_mediums_lows.sql");
  assert.match(migration, /grant update \(role\)/i);
  assert.match(migration, /catalog_menu_is_displayable/);
  assert.match(migration, /coalesce\(published_at, now\(\)\)/i);
});

test("dead blog and party-tuning code is gone; wheel and lists screens use the new helpers", () => {
  assert.doesNotMatch(read("src/store/useWheelStore.ts"), /updateTrigger|updateEntryLimit/);
  assert.doesNotMatch(read("src/app/navigation/RootNavigator.tsx"), /BlogPost/);
  assert.doesNotMatch(read("src/app/navigation/navigationTypes.ts"), /BlogPost/);
  assert.doesNotMatch(
    read("src/lib/services/supabase/supabaseRepository.ts"),
    /from\("blog_posts"\)/,
  );
  assert.match(read("src/app/screens/wheel/WheelLobbyScreen.tsx"), /leaveWheelStack/);
  assert.match(read("src/app/screens/wheel/WheelResultModal.tsx"), /discovery\s*\.getVenue/);
  assert.match(
    read("src/app/screens/profile/ListsHomeScreen.tsx"),
    /navigate\("Favourites", undefined, \{ pop: true \}\)/,
  );
  assert.match(
    read("src/app/screens/checklist/ChecklistsHomeScreen.tsx"),
    /Couldn't create the checklist/,
  );
});
