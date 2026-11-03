// Home's sideways scroller. Run with
// `HUNGRY_DATA_SOURCE=mock node scripts/test-render.mjs src/components/ui/RailScrollView.render.test.tsx`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { afterEach } from "node:test";
import { Text } from "react-native";

import { cleanup, render } from "@/test/render";

import { RailScrollView } from "./RailScrollView";

afterEach(cleanup);

test("RailScrollView shows its children in a sideways scroller", async () => {
  const view = await render(
    <RailScrollView horizontal testID="rail">
      <Text>First card</Text>
      <Text>Second card</Text>
    </RailScrollView>,
  );
  assert.ok(view.findByTestId("rail"), "the scroller renders");
  assert.match(view.text(), /First card/);
  assert.match(view.text(), /Second card/);
});

test("on a phone it is gesture-handler's ScrollView, so two rows can be swiped at once", () => {
  const source = readFileSync("src/components/ui/RailScrollView.tsx", "utf8");
  assert.match(source, /Platform\.OS === "web" \? NativeScrollView : GestureScrollView/);
  // Home's rows, the Home chips and the dish rails all use it rather than the plain ScrollView.
  const home = readFileSync("src/app/screens/discover/DiscoverHomeScreen.tsx", "utf8");
  assert.doesNotMatch(home, /<ScrollView\s+horizontal/);
  const chips = readFileSync("src/components/ui/FilterChipRail.tsx", "utf8");
  assert.match(chips, /<RailScrollView/);
  const rail = readFileSync("src/components/discover/home/DiscoverBiteRail.tsx", "utf8");
  assert.doesNotMatch(rail, /<ScrollView\s+horizontal/);
});
