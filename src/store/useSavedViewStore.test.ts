import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { useSavedViewStore } from "./useSavedViewStore";

beforeEach(() => useSavedViewStore.getState().reset());

test("useSavedViewStore opens on Dishes, Want to try, List", () => {
  const state = useSavedViewStore.getState();
  assert.equal(state.section, "dishes");
  assert.equal(state.tab, "want");
  assert.equal(state.mode, "list");
});

test("useSavedViewStore keeps the last section, tab and mode until reset", () => {
  const { setSection, setTab, setMode, reset } = useSavedViewStore.getState();
  setSection("stalls");
  setTab("tried");
  setMode("map");
  assert.deepEqual(
    [
      useSavedViewStore.getState().section,
      useSavedViewStore.getState().tab,
      useSavedViewStore.getState().mode,
    ],
    ["stalls", "tried", "map"],
  );
  reset();
  assert.equal(useSavedViewStore.getState().section, "dishes");
  assert.equal(useSavedViewStore.getState().mode, "list");
});

test("a different account starts Saved on Dishes (the session clears the view store)", async () => {
  const { useSessionStore } = await import("./useSessionStore");
  useSavedViewStore.getState().setSection("lists");
  useSessionStore.getState().signOut();
  assert.equal(useSavedViewStore.getState().section, "dishes");
});

test("only the section is kept on the device; Want to try and List / Map are session-only", () => {
  const options = useSavedViewStore.persist.getOptions();
  assert.equal(options.name, "hungry-saved-view-v1");
  const saved = options.partialize?.({
    ...useSavedViewStore.getState(),
    section: "lists",
    tab: "tried",
    mode: "map",
  });
  assert.deepEqual(saved, { section: "lists" });
});
