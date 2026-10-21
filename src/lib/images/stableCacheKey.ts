/**
 * Signed storage URLs carry a fresh token on every signing, so the image disk cache
 * (keyed by URL) misses after each app launch and the full-size photo downloads again.
 * The object path (the URL without its query) names the same file every time, so it
 * makes a stable cache key.
 */
const SIGNED_STORAGE_URL = /\/storage\/v1\/(?:object|render\/image)\/sign\//;

export function stableCacheKeyForUri(uri: string | undefined): string | undefined {
  if (!uri || !SIGNED_STORAGE_URL.test(uri)) return undefined;
  const withoutQuery = uri.split(/[?#]/)[0];
  return withoutQuery || undefined;
}
