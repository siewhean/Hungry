import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import {
  activeChoiceSheetHostId,
  askChoice,
  notifyChoiceSheetClosed,
  registerChoiceSheetHost,
  subscribeChoiceSheetHosts,
  useChoiceSheetStore,
} from "./useChoiceSheetStore";

const OPTIONS = [
  { id: "camera", label: "Take photo" },
  { id: "library", label: "Choose from library" },
];

beforeEach(() => useChoiceSheetStore.setState({ request: null, sheetOpen: false }));

test("askChoice resolves with the id of the option that is picked", async () => {
  const answer = askChoice({ title: "Add a photo", options: OPTIONS });
  assert.equal(useChoiceSheetStore.getState().request?.title, "Add a photo");
  useChoiceSheetStore.getState().settle("library");
  notifyChoiceSheetClosed();
  assert.equal(await answer, "library");
  assert.equal(useChoiceSheetStore.getState().request, null);
});

test("a dismissed sheet resolves null", async () => {
  const answer = askChoice({ title: "Add a photo", options: OPTIONS });
  useChoiceSheetStore.getState().settle(null);
  notifyChoiceSheetClosed();
  assert.equal(await answer, null);
});

test("asking again answers the open question as dismissed", async () => {
  const first = askChoice({ title: "First", options: OPTIONS });
  const second = askChoice({ title: "Second", options: OPTIONS });
  assert.equal(useChoiceSheetStore.getState().request?.title, "Second");
  useChoiceSheetStore.getState().settle("camera");
  notifyChoiceSheetClosed();
  assert.equal(await first, null);
  assert.equal(await second, "camera");
});

test("settling with nothing open does nothing", () => {
  useChoiceSheetStore.getState().settle("camera");
  assert.equal(useChoiceSheetStore.getState().request, null);
});

test("the answer waits until the sheet has left the screen", async () => {
  const answer = askChoice({ title: "Add a photo", options: OPTIONS });
  let resolved = false;
  void answer.then(() => (resolved = true));
  useChoiceSheetStore.getState().settle("camera");
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(resolved, false, "a photo picker opened now would be refused while the sheet is up");
  notifyChoiceSheetClosed();
  assert.equal(await answer, "camera");
});

test("with no sheet mounted the answer still arrives", async () => {
  const answer = askChoice({ title: "Add a photo", options: OPTIONS });
  useChoiceSheetStore.getState().settle("library");
  assert.equal(await answer, "library");
});

test("the newest registered host is the active one, and the older takes over when it leaves", () => {
  let notified = 0;
  const unsubscribe = subscribeChoiceSheetHosts(() => {
    notified += 1;
  });
  const root = registerChoiceSheetHost();
  assert.equal(activeChoiceSheetHostId(), root.id);
  const card = registerChoiceSheetHost();
  assert.equal(activeChoiceSheetHostId(), card.id);
  card.unregister();
  assert.equal(activeChoiceSheetHostId(), root.id);
  root.unregister();
  assert.equal(activeChoiceSheetHostId(), null);
  unsubscribe();
  assert.equal(notified, 4);
});
