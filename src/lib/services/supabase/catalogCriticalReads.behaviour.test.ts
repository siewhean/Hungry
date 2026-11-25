import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";

import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake } = installFakeSupabase();
const VENUE_ID = "stall-venue";
const DISH_ID = "stall-dish";
let service: typeof import("./supabaseService").supabaseService.discovery;
let catalogReadOutcome: typeof import("../catalogReads").catalogReadOutcome;
let analytics: typeof import("@/lib/analytics");

before(async () => {
  service = (await import("./supabaseService")).supabaseService.discovery;
  catalogReadOutcome = (await import("../catalogReads")).catalogReadOutcome;
  analytics = await import("@/lib/analytics");
});

beforeEach(() => {
  fake.rpcCalls.length = 0;
  fake.queries.length = 0;
  fake.rpc = {};
  fake.tables = {};
  analytics.clearTrackedAnalyticsEvents();
});

test("the first Discover page returns actionable text and price before optional reads", async () => {
  fake.rpc.get_discovery_feed_by_location = () => ({
    data: [
      {
        venue_id: VENUE_ID,
        venue_name: "Fixture stall",
        top_dish_id: DISH_ID,
        top_dish_name: "Fixture dish",
        top_dish_price: 5,
      },
    ],
  });

  const feed = await service.listDiscoveryFeedByLocation({ limit: 10, deferEnrichment: true });
  assert.equal(feed?.results[0]?.dish.name, "Fixture dish");
  assert.equal(feed?.results[0]?.dish.price, 5);
  assert.equal(feed?.needsEnrichment, true);
  assert.equal(fake.queries.length, 0);
  assert.equal(fake.rpcCalls.length, 1);
});

test("timeouts and rate limits remain distinguishable and do not hydrate the catalog", async () => {
  for (const [code, message, expected] of [
    ["57014", "canceling statement due to statement timeout", "timeout"],
    ["PT429", "Too many requests", "rate-limit"],
    ["PGRST301", "JWT expired", "auth"],
  ] as const) {
    fake.rpc.get_discovery_feed_by_location = () => ({ error: { code, message } });
    await assert.rejects(
      service.listDiscoveryFeedByLocation({ limit: 10, deferEnrichment: true }),
      (error: { code?: string }) => error.code === code && catalogReadOutcome(error) === expected,
    );
  }
  assert.equal(fake.queries.length, 0);
});

test("empty Discover and missing dish are authoritative and perform no broad reads", async () => {
  fake.rpc.get_discovery_feed_by_location = () => ({ data: [] });
  fake.rpc.get_dish_detail = () => ({ data: [] });
  assert.deepEqual(await service.listDiscoveryFeedByLocation({ limit: 10 }), {
    venues: [],
    results: [],
    needsEnrichment: false,
  });
  assert.ok(service.getDishDetail);
  assert.equal(await service.getDishDetail(DISH_ID), undefined);
  assert.deepEqual(
    fake.callsTo("get_dish_detail").map(({ args }) => args),
    [{ p_dish_id: DISH_ID }],
  );
  assert.equal(fake.queries.length, 0);
});

test("an auth failure during closure verification stays an auth failure", async () => {
  fake.rpc.get_discovery_feed_by_location = () => ({
    data: [{ venue_id: VENUE_ID, venue_name: "Fixture stall" }],
  });
  fake.rpc.get_venue_closures = () => ({
    error: { code: "PGRST301", message: "JWT expired" },
  });
  const first = (await service.listDiscoveryFeedByLocation({ deferEnrichment: true }))!;
  await assert.rejects(
    service.enrichDiscoveryFeed!(first),
    (error) => catalogReadOutcome(error) === "auth",
  );
});

test("only a valid closure response verifies or clears a stall pause", async () => {
  const closedUntil = "2030-01-01T12:00:00Z";
  fake.rpc.get_discovery_feed_by_location = () => ({
    data: [{ venue_id: VENUE_ID, venue_name: "Fixture stall" }],
  });
  fake.rpc.get_venue_closures = () => ({
    data: [{ venue_id: VENUE_ID, closed_until: closedUntil }],
  });
  const first = (await service.listDiscoveryFeedByLocation({ deferEnrichment: true }))!;
  const paused = await service.enrichDiscoveryFeed!(first);
  assert.equal(paused.venues[0]?.closedUntil, closedUntil);

  fake.rpc.get_venue_closures = () => ({
    data: [{ venue_id: VENUE_ID, closed_until: {} }],
  });
  const unverified = await service.enrichDiscoveryFeed!({ ...paused, needsEnrichment: true });
  assert.equal(unverified.needsEnrichment, true);
  assert.equal(unverified.venues[0]?.closedUntil, closedUntil);

  fake.rpc.get_venue_closures = () => ({ data: [] });
  const current = await service.enrichDiscoveryFeed!(unverified);
  assert.equal(current.needsEnrichment, false);
  assert.equal(current.venues[0]?.closedUntil, undefined);
});

test("a full legacy menu with no last score is rejected before caching", async () => {
  const venueId = "invalid-menu-cursor";
  const dishes = Array.from({ length: 50 }, (_, index) => ({
    venue_id: venueId,
    dish_id: `dish-${index}`,
    name: "Dish",
  }));
  fake.rpc.get_venue_detail = () => ({
    data: [{ venue_id: venueId, name: "Fixture stall", dishes }],
  });
  await assert.rejects(
    service.getStallLegacyMenuPage!(venueId),
    (error) => catalogReadOutcome(error) === "contract",
  );
  fake.rpc.get_venue_detail = () => ({
    error: { code: "57014", message: "statement timeout" },
  });
  await assert.rejects(
    service.getStallLegacyMenuPage!(venueId),
    (error) => catalogReadOutcome(error) === "timeout",
  );
});

test("strict reads record contract errors instead of success for malformed payloads", async () => {
  fake.rpc.get_discovery_feed_by_location = () => ({ data: [{ name: "Bad response" }] });
  fake.rpc.get_dish_detail = () => ({ data: [{ name: "Wrong dish", dish_id: "other" }] });
  fake.rpc.get_stall_header = () => ({ data: [{ name: "Wrong stall", venue_id: "other" }] });
  fake.rpc.get_stall_menu_page = () => ({ data: [{ dishes: {}, next_cursor: null }] });
  fake.rpc.get_venue_detail = () => ({
    data: [{ venue_id: VENUE_ID, name: "Stall", dishes: {} }],
  });
  for (const read of [
    service.listDiscoveryFeedByLocation({ limit: 10 }),
    service.getDishDetail!(DISH_ID),
    service.getStallHeader!(VENUE_ID),
    service.listStallMenuPage!(VENUE_ID),
    service.getStallLegacyMenuPage!(VENUE_ID),
  ]) {
    await assert.rejects(read, (error) => catalogReadOutcome(error) === "contract");
  }
  const events = analytics
    .getTrackedAnalyticsEvents()
    .filter(({ event }) => event === "catalog_performance")
    .map(({ properties }) => [properties.milestone, properties.outcome]);
  assert.deepEqual(
    events.sort(([left], [right]) => String(left).localeCompare(String(right))),
    [
      ["get_discovery_feed_by_location", "contract"],
      ["get_dish_detail", "contract"],
      ["get_stall_header", "contract"],
      ["get_stall_menu_page", "contract"],
      ["get_venue_detail", "contract"],
    ],
  );

  fake.rpc.get_venue_detail = () => ({
    data: [{ venue_id: VENUE_ID, name: "Stall", dishes: [] }],
  });
  assert.deepEqual(await service.getStallLegacyMenuPage!(VENUE_ID), {
    dishes: [],
    nextCursor: undefined,
  });
});

test("a failed dietary read remains pending even after closures are verified", async () => {
  fake.rpc.get_discovery_feed_by_location = () => ({
    data: [
      {
        venue_id: VENUE_ID,
        venue_name: "Stall",
        top_dish_id: DISH_ID,
        top_dish_name: "Dish",
        top_dish_dietary_flags: ["halal"],
      },
    ],
  });
  fake.rpc.get_venue_closures = () => ({ data: [] });
  fake.tables.dish_taste_vectors = () => ({ data: [] });
  fake.tables.dish_dietary_flags = () => ({
    error: { code: "PT503", message: "Service unavailable" },
  });
  fake.tables.dietary_flags = () => ({ data: [] });
  const first = (await service.listDiscoveryFeedByLocation({ deferEnrichment: true }))!;
  assert.deepEqual(first.results[0]?.dish.dietaryFlags, ["halal"]);
  const pending = await service.enrichDiscoveryFeed!(first);
  assert.equal(pending.needsEnrichment, true);
  assert.deepEqual(pending.results[0]?.dish.dietaryFlags, []);

  fake.tables.dish_dietary_flags = () => ({ data: [] });
  const verified = await service.enrichDiscoveryFeed!(first);
  assert.equal(verified.needsEnrichment, false);
  assert.deepEqual(verified.results[0]?.dish.dietaryFlags, []);

  const calls = fake.queries.length;
  const noDishes = await service.enrichDiscoveryFeed!({ ...first, results: [] });
  assert.equal(noDishes.needsEnrichment, false);
  assert.equal(fake.queries.length, calls);
});

test("the stall header and menu page use separate RPCs and round-trip the cursor", async () => {
  fake.rpc.get_stall_header = () => ({ data: [{ venue_id: VENUE_ID, name: "Stall" }] });
  fake.rpc.get_stall_menu_page = () => ({
    data: [
      {
        dishes: [{ venue_id: VENUE_ID, dish_id: DISH_ID, name: "Dish", price: 5 }],
        next_cursor: "venue-bound-cursor",
      },
    ],
  });
  assert.equal((await service.getStallHeader?.(VENUE_ID))?.id, VENUE_ID);
  assert.equal(fake.callsTo("get_stall_menu_page").length, 0);
  const first = await service.listStallMenuPage?.(VENUE_ID);
  assert.equal(first?.dishes[0]?.id, DISH_ID);
  fake.rpc.get_stall_menu_page = () => ({ data: [{ dishes: [], next_cursor: null }] });
  assert.deepEqual(await service.listStallMenuPage?.(VENUE_ID, first?.nextCursor), {
    dishes: [],
    nextCursor: undefined,
  });
  assert.deepEqual(fake.callsTo("get_stall_menu_page").at(-1)?.args, {
    p_venue_id: VENUE_ID,
    p_cursor: "venue-bound-cursor",
    p_limit: 20,
  });
  assert.equal(fake.queries.length, 0);
});

test("an in-flight protected stall response cannot populate the next account's cache", async () => {
  const { useSessionStore } = await import("@/store/useSessionStore");
  const { getInlineMerchantReads } = await import("./supabaseRepository");
  const previous = useSessionStore.getState();
  let completeOldRead!: (value: { data: object[] }) => void;
  fake.rpc.get_venue_detail = () =>
    new Promise((resolve) => {
      completeOldRead = resolve;
    });
  useSessionStore.setState({ isAuthenticated: true, authenticatedUserId: "account-a" });
  try {
    const old = service.getStallHeader!(VENUE_ID, { legacy: true });
    useSessionStore.setState({ authenticatedUserId: "account-b" });
    fake.rpc.get_venue_detail = () => ({
      data: [
        {
          venue_id: VENUE_ID,
          name: "Stall",
          dishes: [],
          merchant_profile: null,
          claim_status: "none",
        },
      ],
    });
    const current = await service.getStallHeader!(VENUE_ID, { legacy: true });
    completeOldRead({
      data: [{ venue_id: VENUE_ID, merchant_profile: null, claim_status: "approved" }],
    });
    await assert.rejects(old, (error) => catalogReadOutcome(error) === "cancelled");
    assert.equal(current?.id, VENUE_ID);
    assert.equal((await getInlineMerchantReads(VENUE_ID))?.claimStatus, "none");
    assert.equal(fake.callsTo("get_venue_detail").length, 2);
  } finally {
    useSessionStore.setState(previous);
  }
});

test("legacy stalls reuse only timely verified snapshots after transient failures", async (context) => {
  const { invalidateVenueDetail } = await import("./supabaseRepository");
  const venueId = "cached-stall";
  const clock = context.mock.method(Date, "now", () => 1_000_000);
  assert.ok(service.getStallHeader && service.getStallLegacyMenuPage);
  fake.rpc.get_venue_detail = () => ({
    data: [
      {
        venue_id: venueId,
        name: "Cached stall",
        dishes: Array.from({ length: 50 }, (_, index) => ({
          venue_id: venueId,
          dish_id: `${DISH_ID}-${index}`,
          name: "Cached dish",
          cursor_score: 50 - index,
          cursor_id: `${DISH_ID}-${index}`,
        })),
      },
    ],
  });
  try {
    assert.equal((await service.getStallHeader(venueId, { legacy: true }))?.id, venueId);

    clock.mock.mockImplementation(() => 1_031_000);
    fake.rpc.get_venue_detail = () => ({
      error: { code: "57014", message: "statement timeout" },
    });
    const cachedHeader = await service.getStallHeader(venueId, { legacy: true });
    assert.equal(cachedHeader?.id, venueId);
    assert.equal(cachedHeader?.isFallback, true);
    const cached = await service.getStallLegacyMenuPage(venueId);
    assert.equal(cached.isFallback, true);
    assert.equal(cached.dishes[0]?.id, `${DISH_ID}-0`);
    assert.equal(cached.dishes[0]?.halalStatus, "unknown");
    assert.deepEqual(cached.dishes[0]?.dietaryFlags, []);
    assert.equal(cached.nextCursor?.id, `${DISH_ID}-49`);
    assert.equal(cached.nextCursor?.score, 1);

    fake.rpc.search_dishes = () => ({
      error: { code: "57014", message: "statement timeout" },
    });
    await assert.rejects(
      service.getStallLegacyMenuPage(venueId, cached.nextCursor),
      (error) => catalogReadOutcome(error) === "timeout",
    );

    clock.mock.mockImplementation(() => 1_120_001);
    await assert.rejects(
      service.getStallHeader(venueId, { legacy: true }),
      (error) => catalogReadOutcome(error) === "timeout",
    );
    assert.equal(fake.queries.length, 0);
  } finally {
    invalidateVenueDetail(venueId);
  }
});

test("legacy aliases surface access revocation and do not reuse another account's snapshot", async (context) => {
  const { useSessionStore } = await import("@/store/useSessionStore");
  const previous = useSessionStore.getState();
  const clock = context.mock.method(Date, "now", () => 2_000_000);
  const venueId = "scope-test-venue";
  assert.ok(service.getStallHeader && service.getStallLegacyMenuPage);
  useSessionStore.setState({ isAuthenticated: true, authenticatedUserId: "cache-account-a" });
  const useValidStall = () => {
    fake.rpc.get_venue_detail = () => ({
      data: [{ venue_id: venueId, name: "Cached stall", dishes: [] }],
    });
  };
  try {
    useValidStall();
    await service.getStallHeader(venueId, { legacy: true });
    clock.mock.mockImplementation(() => 2_031_000);
    fake.rpc.get_venue_detail = () => ({ error: { code: "42501", message: "Access denied" } });
    await assert.rejects(
      service.getStallLegacyMenuPage(venueId),
      (error) => catalogReadOutcome(error) === "auth",
    );
    fake.rpc.get_venue_detail = () => ({ error: { code: "57014", message: "statement timeout" } });
    await assert.rejects(
      service.getStallHeader(venueId, { legacy: true }),
      (error) => catalogReadOutcome(error) === "timeout",
    );
    useValidStall();
    await service.getStallHeader(venueId, { legacy: true });
    useSessionStore.setState({ authenticatedUserId: "cache-account-b" });
    fake.rpc.get_venue_detail = () => ({ error: { code: "57014", message: "statement timeout" } });
    await assert.rejects(
      service.getStallHeader(venueId, { legacy: true }),
      (error) => catalogReadOutcome(error) === "timeout",
    );
    assert.equal(fake.queries.length, 0);
  } finally {
    useSessionStore.setState(previous);
  }
});
