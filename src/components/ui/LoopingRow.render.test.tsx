// The sideways-drifting row of chips. Run with
// `HUNGRY_DATA_SOURCE=mock node scripts/test-render.mjs src/components/ui/LoopingRow.render.test.tsx`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { AppText } from "./AppText";
import { LoopingRow } from "./LoopingRow";
import { cleanup, render } from "@/test/render";

afterEach(cleanup);

test("a row with nothing to scroll shows each chip once", async () => {
  const view = await render(
    <LoopingRow gap={8} testID="row">
      <AppText>Laksa</AppText>
      <AppText>Chicken rice</AppText>
    </LoopingRow>,
  );
  assert.ok(view.findByTestId("row"));
  assert.equal(view.text().match(/Laksa/g)?.length, 1, "no second copy until the row overflows");
  assert.match(view.text(), /Chicken rice/);
});

test("with reduced motion the row is a plain scrolling row of the same chips", async () => {
  const view = await render(
    <LoopingRow gap={8} reduceMotion testID="row">
      <AppText>Laksa</AppText>
      <AppText>Satay</AppText>
    </LoopingRow>,
  );
  assert.match(view.text(), /Laksa/);
  assert.match(view.text(), /Satay/);
  assert.equal(view.text().match(/Laksa/g)?.length, 1);
});
