// The picture-led grid cell the Budget page, Search and the Stalls tab share. Run with
// `npm run test:render`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { createElement } from "react";

import { formatPhotoGridDistance, PhotoGridCard } from "@/components/discover/PhotoGridCard";
import { cleanup, render } from "@/test/render";

afterEach(cleanup);

test("it shows the chip, the name, the distance and the rating, and opens on tap", async () => {
  let opened = 0;
  const view = await render(
    createElement(PhotoGridCard, {
      accessibilityLabel: "Open Jellyfish 100G",
      chipLabel: "Sushi Express Jurong Point",
      distanceLabel: "486m",
      onPress: () => (opened += 1),
      ratingLabel: "4.5 (12)",
      testID: "photo-card",
      title: "Jellyfish 100G",
      width: 180,
    }),
  );
  assert.match(view.text(), /Sushi Express Jurong Point/);
  assert.match(view.text(), /Jellyfish 100G/);
  assert.match(view.text(), /486m/);
  assert.match(view.text(), /4\.5 \(12\)/);
  await view.press(view.findByTestId("photo-card"));
  assert.equal(opened, 1);
});

test("with no chip, distance or rating it shows only the name", async () => {
  const view = await render(
    createElement(PhotoGridCard, {
      accessibilityLabel: "Open Laksa",
      onPress: () => undefined,
      title: "Laksa",
      width: 180,
    }),
  );
  assert.match(view.text(), /Laksa/);
  assert.doesNotMatch(view.text(), /\dm|km|\d\.\d/);
});

test("distance reads in metres under a kilometre and in kilometres above", () => {
  assert.equal(formatPhotoGridDistance(486.4), "486m");
  assert.equal(formatPhotoGridDistance(1200), "1.2km");
  assert.equal(formatPhotoGridDistance(undefined), undefined);
});
