// List detail and collaborators on web (SAVED4-7, SAVED4-12): Delete list, Remove item, Leave
// list and Remove collaborator ask with a Dialog (Alert.alert does nothing on react-native-web),
// and an owner whose profile id lags the signed-in account still gets owner controls. Run with
// `node scripts/test-render.mjs src/app/screens/portfolio/portfolioDialogs.render.test.tsx`.

import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { PortfolioCollaboratorsScreen } from "@/app/screens/portfolio/PortfolioCollaboratorsScreen";
import { PortfolioDetailScreen } from "@/app/screens/portfolio/PortfolioDetailScreen";
import { getHungryService } from "@/lib/services/serviceProvider";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import type { Portfolio, PortfolioCollaborator } from "@/types/domain";

const restores: (() => void)[] = [];
function stub<T extends object, K extends keyof T>(target: T, key: K, value: T[K]) {
  const original = target[key];
  target[key] = value;
  restores.push(() => {
    target[key] = original;
  });
}

beforeEach(async () => {
  await enterScenario("user");
});
afterEach(async () => {
  await cleanup();
  while (restores.length) restores.pop()?.();
});

async function ownList(): Promise<Portfolio> {
  const portfolio = await usePortfolioStore.getState().createPortfolio({
    name: "Dialog list",
    type: "recommendation",
    visibility: "private",
  });
  return portfolio;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("Delete list asks in a Dialog, then deletes and goes back (web)", async () => {
  const portfolio = await ownList();
  const view = await renderScreen(PortfolioDetailScreen as never, {
    name: "PortfolioDetail",
    params: { portfolioId: portfolio.id },
  });
  await view.press(view.findByLabel("More list options"));
  await view.press(view.findByText("Delete list"));
  // The options menu closes first, then the confirm opens.
  await wait(350);
  await view.settle();
  assert.ok(view.findByText("Delete this list?"));
  assert.ok(view.findByText("This can't be undone."));

  await view.press(view.findByText("Delete"));
  assert.equal(
    usePortfolioStore.getState().portfolios.some((entry) => entry.id === portfolio.id),
    false,
  );
  assert.ok(view.navigation.calls.some((call) => call.method === "goBack"));
});

test("cancelling the Delete list Dialog keeps the list", async () => {
  const portfolio = await ownList();
  const view = await renderScreen(PortfolioDetailScreen as never, {
    name: "PortfolioDetail",
    params: { portfolioId: portfolio.id },
  });
  await view.press(view.findByLabel("More list options"));
  await view.press(view.findByText("Delete list"));
  await wait(350);
  await view.settle();
  const cancels = Array.from(document.body.querySelectorAll("[aria-label='Cancel']"));
  await view.press(cancels[cancels.length - 1] as HTMLElement);
  assert.equal(view.findByText("Delete this list?"), null);
  assert.equal(
    usePortfolioStore.getState().portfolios.some((entry) => entry.id === portfolio.id),
    true,
  );
});

test("Remove item asks in a Dialog and removes only on Remove (web)", async () => {
  const portfolio = await ownList();
  const dishId = "dish-for-dialog";
  await usePortfolioStore.getState().addItem({
    portfolioId: portfolio.id,
    itemType: "dish",
    dishId,
  });
  const view = await renderScreen(PortfolioDetailScreen as never, {
    name: "PortfolioDetail",
    params: { portfolioId: portfolio.id },
  });
  const remove = document.body.querySelector(
    "[aria-label^='Remove '][aria-label$=' from this list']",
  );
  assert.ok(remove, "the item has a remove control");
  await view.press(remove as HTMLElement);
  assert.ok(view.findByText("Remove item?"));
  assert.equal(usePortfolioStore.getState().items[portfolio.id]?.length, 1);

  await view.press(view.findByText("Remove"));
  assert.equal(usePortfolioStore.getState().items[portfolio.id]?.length ?? 0, 0);
});

test("Leave list asks in a Dialog and leaves on confirm (web)", async () => {
  const portfolio = await ownList();
  // Someone else's list that the viewer edits.
  useSessionStore.setState({ authenticatedUserId: "viewer-account-id" });
  const left: string[] = [];
  stub(getHungryService().portfolio, "getPortfolioCollaborators", async () => [
    {
      id: "c1",
      portfolioId: portfolio.id,
      userId: "viewer-account-id",
      role: "editor",
      createdAt: "2026-10-01T00:00:00Z",
    } as PortfolioCollaborator,
  ]);
  stub(getHungryService().portfolio, "removePortfolioCollaborator", async (_id, userId) => {
    left.push(userId as string);
  });
  const view = await renderScreen(PortfolioDetailScreen as never, {
    name: "PortfolioDetail",
    params: { portfolioId: portfolio.id },
  });
  await view.press(view.findByText("Leave list"));
  assert.ok(view.findByText("Leave this list?"));
  await view.press(view.findByText("Leave"));
  assert.deepEqual(left, ["viewer-account-id"]);
});

test("an owner whose profile id lags the signed-in account still sees owner controls (SAVED4-12)", async () => {
  const portfolio = await ownList();
  // The signed-in account owns the list; the profile still holds a stale placeholder id.
  useSessionStore.setState({ authenticatedUserId: portfolio.ownerId });
  useProfileStore.setState((state) => ({ profile: { ...state.profile, id: "guest-user" } }));
  const view = await renderScreen(PortfolioDetailScreen as never, {
    name: "PortfolioDetail",
    params: { portfolioId: portfolio.id },
  });
  assert.ok(view.findByLabel("More list options"));
  assert.equal(view.findByText("Follow"), null);
});

test("Remove collaborator asks in a Dialog (web)", async () => {
  const portfolio = await ownList();
  const removed: string[] = [];
  stub(getHungryService().portfolio, "getPortfolioCollaborators", async () => [
    {
      id: "c1",
      portfolioId: portfolio.id,
      userId: "friend-1",
      role: "viewer",
      createdAt: "2026-10-01T00:00:00Z",
      displayName: "Mei Ling",
    } as PortfolioCollaborator,
  ]);
  stub(getHungryService().portfolio, "removePortfolioCollaborator", async (_id, userId) => {
    removed.push(userId as string);
  });
  const view = await renderScreen(PortfolioCollaboratorsScreen as never, {
    name: "PortfolioCollaborators",
    params: { portfolioId: portfolio.id },
  });
  assert.ok(view.findByText("Mei Ling"));
  const remove = document.body.querySelector("[aria-label^='Remove ']");
  assert.ok(remove, "the collaborator row has a remove control");
  await view.press(remove as HTMLElement);
  assert.ok(view.findByText("Remove Mei Ling?"));
  assert.deepEqual(removed, []);
  await view.press(view.findByText("Remove"));
  assert.deepEqual(removed, ["friend-1"]);
});

test("a failed list change shows an error toast, not a native alert", async () => {
  const portfolio = await ownList();
  stub(getHungryService().portfolio, "deletePortfolio", async () => {
    throw new Error("Please sign in again.");
  });
  const view = await renderScreen(PortfolioDetailScreen as never, {
    name: "PortfolioDetail",
    params: { portfolioId: portfolio.id },
  });
  await view.press(view.findByLabel("More list options"));
  await view.press(view.findByText("Delete list"));
  await wait(350);
  await view.settle();
  await view.press(view.findByText("Delete"));
  assert.equal(useUIStore.getState().toast?.tone, "error");
  assert.match(useUIStore.getState().toast?.message ?? "", /sign in again/);
});
