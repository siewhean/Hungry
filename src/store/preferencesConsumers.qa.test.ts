import assert from "node:assert/strict";
import test from "node:test";
import { dishes } from "@/lib/services/mock/data";
import { useUIStore } from "./useUIStore";
import { useSearchStore } from "./useSearchStore";
import { useProfileStore } from "./useProfileStore";

test("history opt-out blocks recent searches and raw-query taste event retention", () => {
  const previous = useUIStore.getState().allowSearchHistory;
  const searchBefore = useSearchStore.getState();
  const profileBefore = useProfileStore.getState();
  const query = dishes[0].name;
  try {
    useUIStore.getState().setAllowSearchHistory(false);
    useSearchStore.getState().rememberSearch(query);
    useProfileStore
      .getState()
      .recordTasteInteraction({ type: "search_query", surface: "search", query });
    assert.deepEqual(useSearchStore.getState().recentSearches, searchBefore.recentSearches);
    assert.deepEqual(
      useProfileStore.getState().tasteInteractionEvents,
      profileBefore.tasteInteractionEvents,
    );
    assert.deepEqual(
      useProfileStore.getState().profile.tasteVector,
      profileBefore.profile.tasteVector,
    );
    useUIStore.getState().setAllowSearchHistory(true);
    useSearchStore.getState().rememberSearch(query);
    assert.equal(useSearchStore.getState().recentSearches[0], query);
  } finally {
    useUIStore.getState().setAllowSearchHistory(previous);
    useSearchStore.setState(searchBefore);
    useProfileStore.setState(profileBefore);
  }
});
test("clearHistory removes retained search history while preserving current query and filters", () => {
  const before = useSearchStore.getState();
  try {
    const filters = {
      ...before.filters,
      query: dishes[0].name,
      dietaryFlags: dishes[0].dietaryFlags,
    };
    useSearchStore.setState({ filters, recentSearches: [dishes[0].name] });
    useSearchStore.getState().clearHistory();
    assert.deepEqual(useSearchStore.getState().recentSearches, []);
    assert.deepEqual(useSearchStore.getState().history, []);
    assert.deepEqual(useSearchStore.getState().filters, filters);
  } finally {
    useSearchStore.setState(before);
  }
});
