// The Home stall card: a picture band, the name, a rating only when reviews stand behind it, the
// opening line and the location. Run with `npm run test:render`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { createElement } from "react";

import { StallRailCard } from "@/components/discover/home/StallRailCard";
import { cleanup, render } from "@/test/render";

afterEach(cleanup);

test("it names the stall, its opening line and where it is, and opens on tap", async () => {
  let opened = 0;
  const view = await render(
    createElement(StallRailCard, {
      name: "Ah Kow Laksa",
      imageUrl: "https://example.com/laksa.jpg",
      rating: 4.6,
      openLabel: "Open · Closes 9pm",
      locationLabel: "JW50 Hawker Centre · #01-23",
      width: 240,
      accessibilityLabel: "Open Ah Kow Laksa",
      onPress: () => (opened += 1),
    }),
  );
  assert.match(view.text(), /Ah Kow Laksa/);
  assert.match(view.text(), /Open · Closes 9pm/);
  assert.match(view.text(), /JW50 Hawker Centre/);
  assert.match(view.text(), /4\.6/);
  await view.press(view.findByTestId("stall-rail-card"));
  assert.equal(opened, 1);
});

test("without a rating or photo it still shows the name and the logo band", async () => {
  const view = await render(
    createElement(StallRailCard, {
      name: "Bee Chicken Rice",
      width: 240,
      accessibilityLabel: "Open Bee Chicken Rice",
      onPress: () => undefined,
    }),
  );
  assert.match(view.text(), /Bee Chicken Rice/);
  assert.doesNotMatch(view.text(), /\d\.\d/);
});
