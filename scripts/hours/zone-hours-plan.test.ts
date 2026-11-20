import assert from "node:assert/strict";
import test from "node:test";

import { planZoneHours } from "./zone-hours-plan";

const DAILY_9_TO_9 =
  "Monday: 9 am–9 pm; Tuesday: 9 am–9 pm; Wednesday: 9 am–9 pm; Thursday: 9 am–9 pm; Friday: 9 am–9 pm; Saturday: 9 am–9 pm; Sunday: 9 am–9 pm";

test("clear lines become schedules; empty and unclear lines are left alone", () => {
  const plan = planZoneHours([
    { id: "a", name: "Clear", operating_hours: DAILY_9_TO_9 },
    { id: "b", name: "Empty", operating_hours: "" },
    { id: "c", name: "Missing", operating_hours: null },
    { id: "d", name: "Unclear", operating_hours: "Mon-Fri 9am-6pm" },
  ]);
  assert.deepEqual(plan.counts, { rows: 4, updates: 1, no_hours: 2, unclear: 1 });
  assert.equal(plan.updates[0].id, "a");
  assert.deepEqual(plan.updates[0].schedule.weekly.sun, [{ open: "09:00", close: "21:00" }]);
  assert.deepEqual(
    plan.skipped.map((item) => [item.id, item.reason]),
    [
      ["b", "no_hours"],
      ["c", "no_hours"],
      ["d", "unclear"],
    ],
  );
});
