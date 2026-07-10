import assert from "node:assert/strict";
import test from "node:test";

import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import { getHungryService, setMockServiceProvider } from "@/lib/services/serviceProvider";
import { useChecklistStore } from "@/store/useChecklistStore";
import { usePortfolioStore } from "@/store/usePortfolioStore";

test("checklist store tracks creation/add/tried and rejects duplicate or partial reorder", async () => {
  setMockServiceProvider();
  clearTrackedAnalyticsEvents();
  useChecklistStore.getState()._reset();

  const checklist = await useChecklistStore
    .getState()
    .createChecklist(`Store checklist ${Date.now()}`);
  const item = await useChecklistStore.getState().addItem({
    checklistId: checklist.id,
    itemType: "dish",
    dishId: "dish-chicken-rice",
    plannedVisitDate: "2026-06-01",
    reminderAt: "2026-06-01T18:30:00+08:00",
  });

  assert.equal(item.plannedVisitDate, "2026-06-01");
  assert.equal(item.reminderAt, "2026-06-01T18:30:00+08:00");
  assert.equal(
    useChecklistStore.getState().items[checklist.id]?.[0]?.plannedVisitDate,
    "2026-06-01",
  );

  await assert.rejects(
    () =>
      useChecklistStore.getState().addItem({
        checklistId: checklist.id,
        itemType: "dish",
        dishId: "dish-chicken-rice",
      }),
    /already in the checklist/,
  );

  await useChecklistStore.getState().markItemTried(item.id);
  await useChecklistStore.getState().markItemTried(item.id);
  await assert.rejects(
    () => useChecklistStore.getState().reorderItems(checklist.id, []),
    /requires every current item exactly once/,
  );

  const events = getTrackedAnalyticsEvents().map((event) => event.event);
  assert.equal(events.filter((event) => event === "checklist_created").length, 1);
  assert.equal(events.filter((event) => event === "checklist_item_added").length, 1);
  assert.equal(events.filter((event) => event === "checklist_item_tried").length, 1);
});

test("portfolio store tracks create/add/publish and validates scores and duplicates", async () => {
  setMockServiceProvider();
  clearTrackedAnalyticsEvents();
  usePortfolioStore.getState()._reset();

  const portfolio = await usePortfolioStore.getState().createPortfolio({
    name: `Store portfolio ${Date.now()}`,
    type: "ranking",
    visibility: "private",
  });
  await usePortfolioStore.getState().addItem({
    portfolioId: portfolio.id,
    itemType: "dish",
    dishId: "dish-laksa",
    score: 8.25,
  });

  await assert.rejects(
    () =>
      usePortfolioStore.getState().addItem({
        portfolioId: portfolio.id,
        itemType: "stall",
        stallId: "venue-maxwell",
        score: 11,
      }),
    /score must be between 1 and 10/,
  );
  await assert.rejects(
    () =>
      usePortfolioStore.getState().addItem({
        portfolioId: portfolio.id,
        itemType: "dish",
        dishId: "dish-laksa",
      }),
    /already in the portfolio/,
  );

  await usePortfolioStore.getState().publishPortfolio(portfolio.id);
  await usePortfolioStore.getState().publishPortfolio(portfolio.id);
  await assert.rejects(
    () => usePortfolioStore.getState().reorderItems(portfolio.id, []),
    /requires every current item exactly once/,
  );

  const storedItems = usePortfolioStore.getState().items[portfolio.id] ?? [];
  assert.equal(storedItems[0]?.score, 8.3);

  const events = getTrackedAnalyticsEvents().map((event) => event.event);
  assert.equal(events.filter((event) => event === "portfolio_created").length, 1);
  assert.equal(events.filter((event) => event === "portfolio_item_added").length, 1);
  assert.equal(events.filter((event) => event === "portfolio_published").length, 1);
});

test("portfolio store blocks stale edits and refreshes the latest portfolio", async () => {
  setMockServiceProvider();
  clearTrackedAnalyticsEvents();
  usePortfolioStore.getState()._reset();

  const portfolio = await usePortfolioStore.getState().createPortfolio({
    name: `Conflict portfolio ${Date.now()}`,
    type: "collection",
    visibility: "private",
  });
  usePortfolioStore.setState((state) => ({
    portfolios: state.portfolios.map((entry) =>
      entry.id === portfolio.id ? { ...entry, updatedAt: "2000-01-01T00:00:00.000Z" } : entry,
    ),
  }));
  await getHungryService().portfolio.updatePortfolio(portfolio.id, {
    name: "Remote collaborator edit",
    type: portfolio.type,
    visibility: portfolio.visibility,
  });

  await assert.rejects(
    () =>
      usePortfolioStore.getState().updatePortfolio(portfolio.id, {
        name: "Stale local edit",
        type: portfolio.type,
        visibility: portfolio.visibility,
      }),
    /changed elsewhere/,
  );

  const conflict = usePortfolioStore.getState().conflicts[portfolio.id];
  const refreshedPortfolio = usePortfolioStore
    .getState()
    .portfolios.find((entry) => entry.id === portfolio.id);

  assert.equal(conflict?.localUpdatedAt, "2000-01-01T00:00:00.000Z");
  assert.equal(refreshedPortfolio?.name, "Remote collaborator edit");
  assert.notEqual(refreshedPortfolio?.updatedAt, "2000-01-01T00:00:00.000Z");

  usePortfolioStore.getState().clearConflict(portfolio.id);
  assert.equal(usePortfolioStore.getState().conflicts[portfolio.id], undefined);
});
