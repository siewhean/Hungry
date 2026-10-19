/**
 * The "N places to eat in this area" label. The list is the feed RPC, so the
 * feed size is the honest count while it is under the page limit. Past the
 * limit the separate count is used only when it agrees with the list; when
 * nothing reliable is available the label is hidden (null) instead of
 * showing a skeleton forever.
 */
export function getDiscoverAreaCountLabel(input: {
  isFeedLoaded: boolean;
  feedVenueCount: number;
  feedLimit: number;
  rpcCount: number | null;
}): string | null {
  if (!input.isFeedLoaded) {
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
