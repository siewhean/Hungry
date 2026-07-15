interface BrowseGridDataStateInput {
  browseLoadError: string | null;
  hasBrowseIndex: boolean;
  hasScopedQueryResponse: boolean;
  isQueryLoading: boolean;
  isSupabaseDataSource: boolean;
  queryLoadError: string | null;
  shouldUseQueryScopedFeed: boolean;
}

interface BrowseGridDataState {
  isDataReady: boolean;
  loadError: string | null;
}

export function resolveBrowseGridDataState({
  browseLoadError,
  hasBrowseIndex,
  hasScopedQueryResponse,
  isQueryLoading,
  isSupabaseDataSource,
  queryLoadError,
  shouldUseQueryScopedFeed,
}: BrowseGridDataStateInput): BrowseGridDataState {
  if (shouldUseQueryScopedFeed && isSupabaseDataSource) {
    return {
      isDataReady: hasScopedQueryResponse && !isQueryLoading && !queryLoadError,
      loadError: queryLoadError,
    };
  }

  return {
    isDataReady: hasBrowseIndex,
    loadError: browseLoadError,
  };
}
