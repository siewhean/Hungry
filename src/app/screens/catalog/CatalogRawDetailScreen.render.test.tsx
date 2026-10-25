// CatalogRawDetail: guests, prices and Save copy (DISH-23). Run with `npm run test:render`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { CatalogRawDetailScreen } from "@/app/screens/catalog/CatalogRawDetailScreen";
import { getCatalogRawService, getDataRepository } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { cleanup, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

let restores: (() => void)[] = [];
afterEach(async () => {
  await cleanup();
  for (const restore of restores.reverse()) restore();
  restores = [];
});

function dishParams() {
  const dish = getDataRepository().listPopularNearby()[0];
  return { kind: "dish" as const, id: dish.id, releaseId: "r1" };
}

test("a guest is asked to sign in, not to check their connection", async () => {
  await enterScenario("guest");
  const view = await renderScreen(CatalogRawDetailScreen as never, {
    name: "CatalogRawDetail",
    params: dishParams(),
  });
  assert.match(view.text(), /Sign in to see this listing/);
  assert.doesNotMatch(view.text(), /Check your connection/);
  await view.press(view.findByText("Sign in"));
  assert.ok(
    view.navigation.calls.some(
      (call) => call.method === "navigate" && call.args[0] === "AuthStack",
    ),
  );
});

test("a price of 0 reads 'Price not listed' and Save uses Want to try with a bookmark", async () => {
  await enterScenario("user");
  const service = getCatalogRawService();
  const original = service.getDish.bind(service);
  service.getDish = (async (id: string, releaseId?: string) => ({
    ...(await original(id, releaseId)),
    price: 0,
    priceRange: undefined,
  })) as typeof service.getDish;
  restores.push(() => {
    service.getDish = original;
  });
  const view = await renderScreen(CatalogRawDetailScreen as never, {
    name: "CatalogRawDetail",
    params: dishParams(),
  });
  assert.match(view.text(), /Price not listed/);
  assert.doesNotMatch(view.text(), /S\$0\.00/);
  assert.doesNotMatch(view.text(), /favourites/i);
});

test("Saved reads as selected, and Open dish page says it came from here (DISH-V2, DISH-V3)", async () => {
  await enterScenario("user");
  const params = dishParams();
  const profile = useProfileStore.getState().profile;
  useProfileStore.setState({
    profile: { ...profile, favouriteDishIds: [...profile.favouriteDishIds, params.id] },
  });
  const service = getCatalogRawService();
  const original = service.getDish.bind(service);
  service.getDish = (async (id: string, releaseId?: string) => ({
    ...(await original(id, releaseId)),
    verificationStatus: "approved",
  })) as typeof service.getDish;
  restores.push(() => {
    service.getDish = original;
  });
  const view = await renderScreen(CatalogRawDetailScreen as never, {
    name: "CatalogRawDetail",
    params,
  });
  // The label says what a tap does, not only the state (react-native-web drops aria-selected
  // on buttons; native gets accessibilityState.selected too).
  assert.ok(view.findByLabel("Saved to Want to try. Tap to remove"));

  await view.press(view.findByText("Open dish page"));
  const opened = view.navigation.calls.find(
    (call) => call.method === "navigate" && call.args[0] === "DishDetail",
  );
  assert.deepEqual(opened?.args[1], { dishId: params.id, source: "catalog_detail" });
});
