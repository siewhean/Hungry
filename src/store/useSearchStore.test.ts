import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { useSearchStore } from "./useSearchStore";
import { useUIStore } from "./useUIStore";

beforeEach(() => {
  useSearchStore.getState().clearSearchHistory();
  useUIStore.setState({ allowSearchHistory: true });
});

test("a submitted search is remembered once, newest first, with its real words (search-L1, L6)", () => {
  const { rememberSearch } = useSearchStore.getState();
  rememberSearch("Union Farm Chicken Rice");
  rememberSearch("laksa");
  rememberSearch("union farm chicken rice");
  assert.deepEqual(useSearchStore.getState().recentSearches, ["union farm chicken rice", "laksa"]);
});

test("a single recent search can be removed (search-L6)", () => {
  const { rememberSearch, removeRecentSearch } = useSearchStore.getState();
  rememberSearch("laksa");
  rememberSearch("satay");
  removeRecentSearch("Laksa");
  assert.deepEqual(useSearchStore.getState().recentSearches, ["satay"]);
});

test("nothing is remembered when search history is off, and only five are kept", () => {
  useUIStore.setState({ allowSearchHistory: false });
  useSearchStore.getState().rememberSearch("laksa");
  assert.deepEqual(useSearchStore.getState().recentSearches, []);

  useUIStore.setState({ allowSearchHistory: true });
  for (const query of ["one", "two", "three", "four", "five", "six"]) {
    useSearchStore.getState().rememberSearch(query);
  }
  assert.deepEqual(useSearchStore.getState().recentSearches, [
    "six",
    "five",
    "four",
    "three",
    "two",
  ]);
});

test("the store no longer carries the unused filters and history", () => {
  const state = useSearchStore.getState() as unknown as Record<string, unknown>;
  for (const removed of ["filters", "history", "addHistoryEntry", "toggleCategory"]) {
    assert.equal(removed in state, false, removed);
  }
});
