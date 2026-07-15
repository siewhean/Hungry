import assert from "node:assert/strict";
import test from "node:test";

import { resolveBrowseGridDataState } from "@/features/search/browseGridDataState";

const baseState = {
  browseLoadError: null,
  hasBrowseIndex: false,
  hasScopedQueryResponse: false,
  isQueryLoading: false,
  isSupabaseDataSource: true,
  queryLoadError: null,
  shouldUseQueryScopedFeed: true,
};

test("scoped Supabase query becomes ready before unrelated base browse hydration", () => {
  const state = resolveBrowseGridDataState({
    ...baseState,
    browseLoadError: "Nearby catalog is temporarily unavailable.",
    hasScopedQueryResponse: true,
  });

  assert.deepEqual(state, {
    isDataReady: true,
    loadError: null,
  });
});

test("scoped query owns its loading and error state while base browse is degraded", () => {
  assert.deepEqual(
    resolveBrowseGridDataState({
      ...baseState,
      browseLoadError: "Nearby catalog is temporarily unavailable.",
      isQueryLoading: true,
    }),
    {
      isDataReady: false,
      loadError: null,
    },
  );

  assert.deepEqual(
    resolveBrowseGridDataState({
      ...baseState,
      browseLoadError: "Nearby catalog is temporarily unavailable.",
      hasBrowseIndex: true,
      hasScopedQueryResponse: true,
      queryLoadError: "Dish search is temporarily unavailable.",
    }),
    {
      isDataReady: false,
      loadError: "Dish search is temporarily unavailable.",
    },
  );
});

test("unscoped browse still requires its bounded base page and reports its own error", () => {
  assert.deepEqual(
    resolveBrowseGridDataState({
      ...baseState,
      browseLoadError: "Nearby catalog is temporarily unavailable.",
      shouldUseQueryScopedFeed: false,
    }),
    {
      isDataReady: false,
      loadError: "Nearby catalog is temporarily unavailable.",
    },
  );
});
