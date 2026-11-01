import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { askChoice, useChoiceSheetStore } from "./useChoiceSheetStore";

const OPTIONS = [
  { id: "camera", label: "Take photo" },
  { id: "library", label: "Choose from library" },
];

beforeEach(() => useChoiceSheetStore.setState({ request: null }));

test("askChoice resolves with the id of the option that is picked", async () => {
  const answer = askChoice({ title: "Add a photo", options: OPTIONS });
  assert.equal(useChoiceSheetStore.getState().request?.title, "Add a photo");
  useChoiceSheetStore.getState().settle("library");
  assert.equal(await answer, "library");
  assert.equal(useChoiceSheetStore.getState().request, null);
});

test("a dismissed sheet resolves null", async () => {
  const answer = askChoice({ title: "Add a photo", options: OPTIONS });
  useChoiceSheetStore.getState().settle(null);
  assert.equal(await answer, null);
});

test("asking again answers the open question as dismissed", async () => {
  const first = askChoice({ title: "First", options: OPTIONS });
  const second = askChoice({ title: "Second", options: OPTIONS });
  assert.equal(await first, null);
  assert.equal(useChoiceSheetStore.getState().request?.title, "Second");
  useChoiceSheetStore.getState().settle("camera");
  assert.equal(await second, "camera");
});

test("settling with nothing open does nothing", () => {
  useChoiceSheetStore.getState().settle("camera");
  assert.equal(useChoiceSheetStore.getState().request, null);
});
