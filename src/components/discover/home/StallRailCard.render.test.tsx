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

test("a stall with no opening hours keeps the opening line's place, so the location lines up", async () => {
  const props = {
    width: 240,
    locationLabel: "Pioneer MRT Station",
    onPress: () => undefined,
  };
  const withHours = await render(
    createElement(StallRailCard, {
      ...props,
      name: "Polar Puffs",
      openLabel: "Open · Closes 8pm",
      reserveOpenLine: true,
      accessibilityLabel: "Open Polar Puffs",
    }),
  );
  assert.equal(withHours.findByTestId("stall-rail-card-open-spacer"), null);
  await cleanup();
  const without = await render(
    createElement(StallRailCard, {
      ...props,
      name: "Jollibean",
      reserveOpenLine: true,
      accessibilityLabel: "Open Jollibean",
    }),
  );
  assert.ok(without.findByTestId("stall-rail-card-open-spacer"), "an empty line holds the place");
  assert.match(without.text(), /Pioneer MRT Station/);
  await cleanup();
  const place = await render(
    createElement(StallRailCard, { ...props, name: "Pioneer Mall", accessibilityLabel: "See" }),
  );
  assert.equal(place.findByTestId("stall-rail-card-open-spacer"), null, "place cards have none");
});
