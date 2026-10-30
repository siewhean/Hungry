/**
 * The "N stalls in this area" label. The list is the feed RPC, so the
 * feed size is the honest count while it is under the page limit. Past the
 * limit the separate count is used only when it agrees with the list; when
 * nothing reliable is available the label is hidden (null) instead of
 * showing a skeleton forever. A feed that came from an empty offline cache
 * (`isFallback`) is a failed read, not "0 places", so it has no count.
 */
export function getDiscoverAreaCountLabel(input: {
  /** True when the live read failed and the saved cache answered. */
  isFallback?: boolean;
  isFeedLoaded: boolean;
  feedVenueCount: number;
  feedLimit: number;
  rpcCount: number | null;
}): string | null {
  if (!input.isFeedLoaded) {
    return null;
  }
  if (input.isFallback && input.feedVenueCount === 0) {
    return null;
  }
  if (input.feedVenueCount < input.feedLimit) {
    return String(input.feedVenueCount);
  }
  if (typeof input.rpcCount === "number" && input.rpcCount >= input.feedVenueCount) {
    return String(input.rpcCount);
  }
  return `${input.feedVenueCount}+`;
}
