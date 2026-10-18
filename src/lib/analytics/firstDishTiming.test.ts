import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

import { firstDishTimingProps, resetFirstDishTimingForTests } from "./firstDishTiming";

test("time to first dish is reported once per app session", () => {
  resetFirstDishTimingForTests(1_000);
  assert.deepEqual(firstDishTimingProps(13_400), {
    is_first_dish_of_session: true,
    seconds_since_app_open: 12,
  });
  assert.deepEqual(firstDishTimingProps(20_000), {});

  for (const path of [
    "src/app/screens/detail/DishDetailScreenV2.tsx",
    "src/app/screens/discover/DecideForMeResultScreen.tsx",
  ]) {
    assert.match(readFileSync(path, "utf8"), /\.\.\.firstDishTimingProps\(\)/, path);
  }
});
