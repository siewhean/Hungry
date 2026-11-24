import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";

import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake } = installFakeSupabase();
const VENUE_ID = "stall-venue";
const DISH_ID = "stall-dish";
let service: typeof import("./supabaseService").supabaseService.discovery;
let catalogReadOutcome: typeof import("./catalogReads").catalogReadOutcome;

before(async () => {
  service = (await import("./supabaseService")).supabaseService.discovery;
  catalogReadOutcome = (await import("./catalogReads")).catalogReadOutcome;
});

beforeEach(() => {
  fake.rpcCalls.length = 0;
  fake.queries.length = 0;
  fake.rpc = {};
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
  assert.equal(await service.getDishDetail?.(DISH_ID), undefined);
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

test("strict reads reject malformed nonempty rows separately from an empty catalog", async () => {
  fake.rpc.get_discovery_feed_by_location = () => ({ data: [{ name: "Bad response" }] });
  await assert.rejects(
    service.listDiscoveryFeedByLocation({ limit: 10 }),
    (error) => catalogReadOutcome(error) === "contract",
  );
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
      data: [{ venue_id: VENUE_ID, name: "Stall", merchant_profile: null, claim_status: "none" }],
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
