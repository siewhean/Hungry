import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import {
  DISCOVER_FEED_CACHE_MAX_AGE_MS,
  clearCachedDiscoverFeed,
  discardDiscoverFirstPage,
  peekDiscoverFirstPage,
  readDiscoverFirstPage,
} from "@/features/discover/feedCache";
import type { DiscoveryLocationFeed } from "@/lib/services/types";

const empty: DiscoveryLocationFeed = { venues: [], results: [] };

beforeEach(clearCachedDiscoverFeed);

test("warm and Home share an in-flight and then a settled first page for 30 seconds", async () => {
  let now = 1000;
  let loads = 0;
  const load = async () => {
    loads += 1;
    return empty;
  };
  const warm = readDiscoverFirstPage("project:account:area", load, false, () => now);
  assert.equal(
    readDiscoverFirstPage("project:account:area", load, false, () => now),
    warm,
  );
  await warm;
  now += DISCOVER_FEED_CACHE_MAX_AGE_MS - 1;
  assert.equal(
    readDiscoverFirstPage("project:account:area", load, false, () => now),
    warm,
  );
  assert.equal(peekDiscoverFirstPage("project:account:area", now)?.promise, warm);
  assert.equal(loads, 1);
  now += 1;
  assert.equal(peekDiscoverFirstPage("project:account:area", now), undefined);
  await readDiscoverFirstPage("project:account:area", load, false, () => now);
  assert.equal(loads, 2);
});

test("only the same scope can reuse a successful response", async () => {
  let loads = 0;
  const load = async () => {
    loads += 1;
    return empty;
  };
  await readDiscoverFirstPage("project-a:account-a:area-a", load);
  await readDiscoverFirstPage("project-b:account-a:area-a", load);
  await readDiscoverFirstPage("project-a:account-b:area-a", load);
  await readDiscoverFirstPage("project-a:account-a:area-b", load);
  assert.equal(loads, 4);
});

test("errors and fallback responses do not become cache hits", async () => {
  await assert.rejects(
    readDiscoverFirstPage("a", async () => {
      throw new Error("timeout");
    }),
  );
  assert.equal(peekDiscoverFirstPage("a"), undefined);
  await readDiscoverFirstPage("a", async () => ({ ...empty, isFallback: true }));
  assert.equal(peekDiscoverFirstPage("a"), undefined);
  assert.deepEqual(await readDiscoverFirstPage("a", async () => empty), empty);
  discardDiscoverFirstPage("a");
  assert.equal(peekDiscoverFirstPage("a"), undefined);
});
