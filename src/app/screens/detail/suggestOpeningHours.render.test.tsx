// The "Add opening hours" page: pick how to describe the hours, send them for review.
import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { SuggestOpeningHoursScreen } from "@/app/screens/detail/SuggestOpeningHoursScreen";
import { getHungryService } from "@/lib/services/serviceProvider";
import { cleanup, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

const restores: (() => void)[] = [];
beforeEach(async () => {
  await enterScenario("user");
});
afterEach(async () => {
  await cleanup();
  while (restores.length) restores.pop()?.();
});

function captureCorrections() {
  const sent: { venueId: string; kind: string; note?: string }[] = [];
  const supply = getHungryService().supply;
  const original = supply.submitCatalogCorrection;
  supply.submitCatalogCorrection = (async (input: {
    venueId: string;
    kind: string;
    note?: string;
  }) => {
    sent.push(input);
  }) as never;
  restores.push(() => {
    supply.submitCatalogCorrection = original;
  });
  return sent;
}

test("every day hours are sent for review as a wrong_hours note", async () => {
  const sent = captureCorrections();
  const view = await renderScreen(SuggestOpeningHoursScreen as never, {
    name: "SuggestOpeningHours",
    params: { venueId: "v1", subjectName: "Nam Sing" },
  });
  assert.match(view.text(), /When is Nam Sing open\?/);
  assert.ok(view.findByLabel("How to set the hours"));
  await view.press(view.findByText("Send opening hours"));
  await view.settle();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].venueId, "v1");
  assert.equal(sent[0].kind, "wrong_hours");
  assert.match(sent[0].note ?? "", /^Opening hours: Daily /);
});

test("weekdays and weekends show separate times, and the weekend can be closed", async () => {
  const sent = captureCorrections();
  const view = await renderScreen(SuggestOpeningHoursScreen as never, {
    name: "SuggestOpeningHours",
    params: { venueId: "v1" },
  });
  await view.press(view.findByLabel("Different hours on weekdays and weekends"));
  assert.ok(view.findByText("Monday to Friday"));
  assert.ok(view.findByText("Saturday and Sunday"));
  await view.press(view.findByLabel("Open on weekends"));
  await view.press(view.findByText("Send opening hours"));
  await view.settle();
  assert.match(sent[0]?.note ?? "", /Sat-Sun Closed/);
});

test("day by day mode asks for open days before it can send", async () => {
  captureCorrections();
  const view = await renderScreen(SuggestOpeningHoursScreen as never, {
    name: "SuggestOpeningHours",
    params: { venueId: "v1" },
  });
  await view.press(view.findByLabel("Set each day and special dates"));
  assert.match(view.text(), /Switch on the days the stall is open/);
  assert.ok(view.findByText("Add special day"));
});
