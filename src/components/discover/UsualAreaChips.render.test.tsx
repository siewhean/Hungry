// Home with location off: the diner's usual areas from onboarding, one tap each.
// Run with `npm run test:render`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { createElement } from "react";

import { UsualAreaChips } from "@/components/discover/UsualAreaChips";
import { usualAreasFor } from "@/features/discover/usualAreas";
import { cleanup, render } from "@/test/render";

afterEach(cleanup);

test("it lists the usual areas and picks the one tapped", async () => {
  const picked: string[] = [];
  const view = await render(
    createElement(UsualAreaChips, {
      areas: usualAreasFor(["tampines", "bishan"]),
      onPick: (area) => picked.push(area.id),
    }),
  );
  assert.match(view.text(), /Your usual areas/);
  assert.match(view.text(), /Tampines/);
  assert.match(view.text(), /Bishan/);
  await view.press(view.findByLabel("Show food in Bishan"));
  assert.deepEqual(picked, ["bishan"]);
});

test("without usual areas it renders nothing", async () => {
  const view = await render(createElement(UsualAreaChips, { areas: [], onPick: () => undefined }));
  assert.doesNotMatch(view.text(), /Your usual areas/);
});
